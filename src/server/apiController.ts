import { Uri, WebviewPanel, Disposable } from 'vscode';
import { IAvatarProvider } from '../adapter/avatar/types';
import { GitOriginType } from '../adapter/repository/index';
import { IApplicationShell } from '../application/types';
import { ICommandManager } from '../application/types/commandManager';
import { IGitCommitViewDetailsCommandHandler } from '../commandHandlers/types';
import { CommitDetails, FileCommitDetails } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Avatar, IGitService, IPostMessage, LogEntry, Ref, RefType } from '../types';
import { captureTelemetry } from '../common/telemetry';

export class ApiController extends Disposable {
    private readonly disposable: Disposable[] = [];
    private readonly commitViewer: IGitCommitViewDetailsCommandHandler;
    private readonly applicationShell: IApplicationShell;
    private stateRequestId = '';

    constructor(
        private webviewPanel: WebviewPanel,
        private gitService: IGitService,
        private serviceContainer: IServiceContainer,
        private commandManager: ICommandManager,
    ) {
        super(() => this.dispose());

        this.commitViewer = this.serviceContainer.get<IGitCommitViewDetailsCommandHandler>(
            IGitCommitViewDetailsCommandHandler,
        );
        this.applicationShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);

        this.webviewPanel.webview.onDidReceiveMessage(this.postMessageParser.bind(this), null, this.disposable);
        this.gitService.onStateChanged(
            () => {
                this.postMessageParser({
                    cmd: 'sendState',
                    requestId: this.stateRequestId,
                    payload: {},
                });
            },
            null,
            this.disposable,
        );
    }
    public getWebviewPanel() {
        return this.webviewPanel;
    }

    public async getLogEntries(args: any) {
        let searchText = args.searchText;
        searchText = typeof searchText === 'string' && searchText.length === 0 ? undefined : searchText;

        const startIndex: number | undefined = args.startIndex ? parseInt(args.startIndex, 10) : 0;
        const stopIndex: number | undefined = args.stopIndex ? parseInt(args.stopIndex, 10) : 30;

        const author: string | undefined = typeof args.authorFilter === 'string' ? args.authorFilter : undefined;
        const lineNumber: number | undefined = args.line ? parseInt(args.line, 10) : undefined;
        const branch = args.branchName;

        const filePath: string | undefined = args.file;
        const file = filePath ? Uri.file(filePath) : undefined;

        const entries = await this.gitService.getLogEntries(
            startIndex,
            stopIndex,
            branch,
            searchText,
            file,
            lineNumber,
            author,
        );

        return {
            ...entries,
            startIndex,
            stopIndex,
        };
    }
    public async getBranches() {
        return this.gitService.getBranches();
    }
    public async getAuthors() {
        return this.gitService.getAuthors();
    }
    public async getCommit(args: any) {
        const hash: string = args.hash;

        const gitRoot = this.gitService.getGitRoot();
        const branch = this.gitService.getCurrentBranch();

        const commit = await this.gitService.getCommit(hash);
        this.commitViewer.viewCommitTree(new CommitDetails(gitRoot, branch, commit as LogEntry));

        return commit;
    }

    @captureTelemetry()
    public async getAvatars() {
        const originType = await this.gitService.getOriginType();
        if (!originType) {
            this.webviewPanel.webview.postMessage({
                cmd: 'getAvatarsResult',
                error: 'No origin type found',
            });

            return;
        }
        const providers = this.serviceContainer.getAll<IAvatarProvider>(IAvatarProvider);
        const provider = providers.find(item => item.supported(originType));
        const genericProvider = providers.find(item => item.supported(GitOriginType.any))!;

        let avatars: Avatar[];

        if (provider) {
            avatars = await provider.getAvatars(this.gitService);
        } else {
            avatars = await genericProvider.getAvatars(this.gitService);
        }

        return avatars;
    }
    public async doActionRef(args: any) {
        const actionName = args.name;
        const hash = decodeURIComponent(args.hash);
        const refEntry = args.ref as Ref;

        switch (actionName) {
            case 'removeTag':
                await this.gitService.removeTag(refEntry.name!);
                break;
            case 'removeBranch':
                await this.gitService.removeBranch(refEntry.name!);
                break;
            case 'removeRemote':
                await this.gitService.removeRemoteBranch(refEntry.name!);
        }

        return this.gitService.getCommit(hash, true);
    }
    public async doAction(args: any) {
        const gitRoot = this.gitService.getGitRoot();
        const branch = this.gitService.getCurrentBranch();

        const actionName = args.name;
        const value: string = decodeURIComponent(args.value);
        const logEntry: LogEntry = args.logEntry;

        switch (actionName) {
            default:
                await this.commandManager.executeCommand(
                    'git.commit.doSomething',
                    new CommitDetails(gitRoot, branch, logEntry),
                );
                break;
            case 'newtag':
                await this.gitService.createTag(value, logEntry.hash.full);
                logEntry.refs.push({ type: RefType.Tag, name: value });
                break;
            case 'newbranch':
                await this.gitService.createBranch(value, logEntry.hash.full);
                logEntry.refs.push({ type: RefType.Head, name: value });
                break;
            case 'reset_hard':
                await this.gitService.reset(logEntry.hash.full, true);
                break;
            case 'reset_soft':
                await this.gitService.reset(logEntry.hash.full);
        }

        return logEntry;
    }
    public async doSomethingWithCommit(args: any) {
        const gitRoot = this.gitService.getGitRoot();
        const branch = this.gitService.getCurrentBranch();
        const logEntry = args.logEntry as LogEntry;

        this.commandManager.executeCommand('git.commit.doSomething', new CommitDetails(gitRoot, branch, logEntry));
    }
    @captureTelemetry()
    public async selectCommittedFile(args: any) {
        const gitRoot = this.gitService.getGitRoot();
        const branch = this.gitService.getCurrentBranch();

        this.commandManager.executeCommand(
            'git.commit.file.select',
            new FileCommitDetails(gitRoot, branch, args.logEntry, args.committedFile),
        );
    }

    public async registerState(args: any) {
        this.stateRequestId = args.requestId;
    }

    public async sendState(args: any) {
        return args;
    }

    private postMessageParser = async (message: IPostMessage) => {
        try {
            const result = await this[message.cmd].bind(this)(message.payload);
            this.webviewPanel.webview.postMessage({
                requestId: message.requestId,
                payload: result,
            });
        } catch (ex) {
            this.applicationShell.showErrorMessage(ex);
            this.webviewPanel.webview.postMessage({
                requestId: message.requestId,
                error: ex,
            });
        }
    };

    public dispose() {
        this.disposable.forEach(disposable => disposable.dispose());
    }
}
