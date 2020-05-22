import * as React from 'react';
import { connect } from 'react-redux';
import { ResultActions } from '../../../actions/results';
import { LogEntries, LogEntry, Ref } from '../../../definitions';
import { RootState } from '../../../reducers';
import BranchGraph from '../BranchGraph';
import LogEntryList from '../LogEntryList';
import Dialog from '../../Dialog';

type LogViewProps = {
    logEntries: LogEntries;
    onViewCommit: typeof ResultActions.selectCommit;
    actionCommit: typeof ResultActions.actionCommit;
    actionRef: typeof ResultActions.actionRef;
};

interface LogViewState {}

class LogView extends React.Component<LogViewProps, LogViewState> {
    private dialog: Dialog;
    constructor(props?: LogViewProps, context?: any) {
        super(props, context);
    }

    public componentWillUpdate(prevProp: LogViewProps) {
        if (this.props.logEntries.selected) {
            return;
        }
    }

    public render() {
        return (
            <div className="log-view" id="scrollCnt">
                <BranchGraph></BranchGraph>
                <LogEntryList
                    onViewCommit={this.onViewCommit}
                    onAction={this.onAction}
                    onRefAction={this.onRefAction}
                />
                <Dialog ref={r => (this.dialog = r)} onOk={this.onDialogOk.bind(this)} />
            </div>
        );
    }

    public onViewCommit = (logEntry: LogEntry) => {
        this.props.onViewCommit(logEntry.hash.full);
    };

    public onRefAction = (logEntry: LogEntry, ref: Ref, name: string) => {
        switch (name) {
            case 'removeTag':
                this.dialog.showConfirm(
                    `Remove tag ${ref.name}?`,
                    `Do you really want to remove the tag ${ref.name}?`,
                    { logEntry, ref, name },
                );
                break;
            case 'removeBranch':
                this.dialog.showConfirm(
                    `Remove branch ${ref.name}?`,
                    `Do you really want to remove the branch ${ref.name}?`,
                    { logEntry, ref, name },
                );
                break;
            case 'removeRemote':
                this.dialog.showConfirm(
                    `Remove remote branch ${ref.name}?`,
                    `Do you really want to remove the remote branch ${ref.name}?`,
                    { logEntry, ref, name },
                );
                break;
        }
    };

    public onAction = (entry: LogEntry, name = '') => {
        switch (name) {
            case 'newtag':
                this.dialog.showInput(
                    `Create a new tag on ${entry.hash.short}`,
                    `<strong>${entry.subject}</strong><br />${entry.author.name} on ${entry.author.date.toISOString()}`,
                    'Enter tag here',
                    { entry, name },
                );
                break;
            case 'newbranch':
                this.dialog.showInput(
                    `Create a branch from ${entry.hash.short}`,
                    `<strong>${entry.subject}</strong><br />${entry.author.name} on ${entry.author.date.toISOString()}`,
                    'Enter branch name here',
                    { entry, name },
                );
                break;
            case 'reset_soft':
                this.dialog.showConfirm(
                    `Reset to ${entry.hash.short}?`,
                    `<p><strong>${entry.subject}</strong><br />${
                        entry.author.name
                    } on ${entry.author.date.toISOString()}</p><small>All affected files will be merged and kept in local workspace</small>`,
                    { entry, name },
                );
                break;
            case 'reset_hard':
                this.dialog.showConfirm(
                    `Reset hard to ${entry.hash.short}?`,
                    `<p><strong>${entry.subject}</strong><br />${
                        entry.author.name
                    } on ${entry.author.date.toISOString()}</p><small style='color: red'>All affected files will be dropped</small>`,
                    { entry, name },
                );
                break;
            default:
                this.props.actionCommit(entry, name);
                break;
        }
    };

    public onDialogOk = (sender: HTMLButtonElement, args: any) => {
        switch (args!.name) {
            case 'newbranch':
            case 'newtag':
                this.props.actionCommit(args.entry, args.name, this.dialog.getValue());
                break;
            case 'reset_soft':
            case 'reset_hard':
                this.props.actionCommit(args.entry, args.name);
                break;
            case 'removeRemote':
            case 'removeBranch':
            case 'removeTag':
                this.props.actionRef(args.logEntry, args.ref, args.name);
                break;
        }
    };
}
function mapStateToProps(state: RootState, wrapper: { logEntries: LogEntries }) {
    return {
        logEntries: wrapper.logEntries,
    };
}

function mapDispatchToProps(dispatch) {
    return {
        onViewCommit: (hash: string) => dispatch(ResultActions.selectCommit(hash)),
        actionCommit: (logEntry: LogEntry, name: string, value = '') =>
            dispatch(ResultActions.actionCommit(logEntry, name, value)),
        actionRef: (logEntry: LogEntry, ref: Ref, name: string) =>
            dispatch(ResultActions.actionRef(logEntry, ref, name)),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LogView);
