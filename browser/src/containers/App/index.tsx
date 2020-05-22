import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ResultActions } from '../../actions/results';
import Header from '../../components/Header';
import Commit from '../../components/LogView/Commit';
import LogView from '../../components/LogView/LogView';
import { ISettings } from '../../definitions';
import { LogEntriesState, RootState } from '../../reducers';
import { IConfiguration } from '../../reducers/vscode';

type AppProps = {
    configuration: IConfiguration;
    settings: ISettings;
    logEntries: LogEntriesState;
    search: typeof ResultActions.search;
} & typeof ResultActions;

interface AppState {}

class App extends React.Component<AppProps, AppState> {
    constructor(props?: AppProps, context?: any) {
        super(props, context);
    }

    public render() {
        const { children } = this.props;
        return (
            <div className="appRootParent">
                <div className="appRoot">
                    <Header></Header>
                    <LogView logEntries={this.props.logEntries}></LogView>
                    {children}
                </div>
                {this.props.logEntries && this.props.logEntries.selected ? <Commit /> : ''}
            </div>
        );
    }
}

function mapStateToProps(state: RootState) {
    return {
        configuration: state.vscode.configuration,
        settings: state.settings,
        logEntries: state.logEntries,
    };
}

function mapDispatchToProps(dispatch) {
    return {
        ...bindActionCreators({ ...ResultActions }, dispatch),
        search: (text: string) => dispatch(ResultActions.search(text)),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
