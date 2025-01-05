import { WebApiTeam } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { TeamSettingsIteration } from 'azure-devops-node-api/interfaces/WorkInterfaces';
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { GLOBAL_STATE } from './constants';
import * as adoClient from './services/adoService';
import { BoardTreeItem, BoardTreeDataProvider } from './treeDataProvider/BoardTreeDataProvider';
import { getSettings } from './utils';

export async function activate(context: vscode.ExtensionContext) {
  let projectId = '';

  try {
    projectId = getSettings().projectId;
  } catch (error) {
    vscode.window
      .showWarningMessage(
        'Please configure all the required settings to use the Azure DevOps Boards extension.',
        'Open Settings',
      )
      .then((selection) => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'adoBoards');
        }
      });
    return;
  }

  const treeDataProvider = new BoardTreeDataProvider();
  const treeView = vscode.window.createTreeView<BoardTreeItem>('adoSprintView', {
    treeDataProvider,
    canSelectMany: false, // TODO
  });
  const commands = registerCommands({ context, treeDataProvider, treeView });
  context.subscriptions.push(...commands);

  const selectedTeam = context.globalState.get<WebApiTeam>(GLOBAL_STATE.SELECTED_TEAM);
  const selectedIteration = context.globalState.get<TeamSettingsIteration>(GLOBAL_STATE.SELECTED_ITERATION);

  if (selectedTeam?.id && selectedIteration?.id) {
    const teamContext = { projectId, teamId: selectedTeam.id };
    treeDataProvider.refresh({ teamContext, iterationIdAsync: selectedIteration.id });
    treeView.title = `${selectedIteration.name ? `${selectedIteration.name} - ` : ''}${selectedTeam.name || ''}`;
  } else {
    try {
      const [team] = await adoClient.getTeams(true);
      if (team.id) {
        const teamContext = { projectId, teamId: team.id };
        const [currentIteration] = await adoClient.getIterations(teamContext, true);
        if (currentIteration?.id) {
          context.globalState.update(GLOBAL_STATE.SELECTED_TEAM, team);
          context.globalState.update(GLOBAL_STATE.SELECTED_ITERATION, currentIteration);
          treeDataProvider.refresh({ teamContext, iterationIdAsync: currentIteration.id });
          treeView.title = `${currentIteration.name ? `${currentIteration.name} - ` : ''}${team.name || ''}`;
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof AggregateError
          ? error.errors.map((e) => e.message).join('\n')
          : error instanceof Error
            ? error.message
            : '';

      console.error(`@!!!!Error: ${errorMessage}`, error);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  // treeDataProvider.onDidChangeTreeData((e) => {
  //   console.log('Tree data changed', e);
  // });
}

// This method is called when your extension is deactivated
export function deactivate() {}
