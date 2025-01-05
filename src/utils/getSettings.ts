import * as vscode from 'vscode';

type Settings = {
  adoPersonalAccessToken: string;
  serverUrl: string;
  projectId: string;
  githubPersonalAccessToken?: string;
  defaultInitialTasks: string[];
  webHook: {
    workItemStateChange?: { url: string; watchStates: string[] };
    pullRequestReadyForReview?: string;
  };
};

export function getSettings(): Settings {
  const config = vscode.workspace.getConfiguration('adoBoards');
  const adoPersonalAccessToken = config.get<string>('adoPersonalAccessToken');
  const serverUrl = config.get<string>('serverUrl');
  const projectId = config.get<string>('projectId');
  const githubPersonalAccessToken = config.get<string>('githubPersonalAccessToken');
  const defaultInitialTasks = JSON.parse(config.get<string>('defaultInitialTasks') || '[]');
  const workItemStateChange = JSON.parse(config.get<string>('webHook.workItemStateChange') || '{}');
  const pullRequestReadyForReview = config.get<string>('webHook.pullRequestReadyForReview');

  if (!adoPersonalAccessToken || !serverUrl || !projectId) {
    throw new Error('Missing required settings.');
  }

  return {
    adoPersonalAccessToken,
    serverUrl,
    projectId,
    githubPersonalAccessToken,
    defaultInitialTasks,
    webHook: {
      workItemStateChange,
      pullRequestReadyForReview,
    },
  };
}
