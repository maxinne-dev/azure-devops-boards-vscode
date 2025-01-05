import * as vscode from 'vscode';
import { getWorkItems } from './adoService';
import { AB_PATTERN } from '../constants';
import { getSettings } from '../utils';

// @ts-ignore
type Octokit = import('@octokit/rest').Octokit;

let _octokitPromise: Promise<Octokit> | null = null;

const getOctokit: () => Promise<Octokit> = async () => {
  if (!_octokitPromise) {
    _octokitPromise = _getOctokit();
  }
  return _octokitPromise;
};

const _getOctokit: () => Promise<Octokit> = async () => {
  const { githubPersonalAccessToken } = getSettings();

  if (!githubPersonalAccessToken) {
    vscode.window
      .showErrorMessage('Please configure githubPersonalAccessToken in settings', 'Open Settings')
      .then((selection) => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'adoBoards.githubPersonalAccessToken');
        }
      });
    throw new Error('Missing githubPersonalAccessToken');
  }

  console.log('Creating github connection...');
  const { Octokit } = await import('@octokit/rest');
  return new Octokit({ auth: githubPersonalAccessToken });
};

/**
 * Append work item title to the pull request body.
 *
 * [AB#12](https://example.com)
 * ->
 * [AB#12](https://example.com) - [System.WorkItemType] System.Title
 *
 * @param url
 *
 * @see https://learn.microsoft.com/en-us/azure/devops/boards/github/link-to-from-github?view=azure-devops#use-ab-to-link-from-github-to-azure-boards-work-items
 */
export const updatePrBody = async (url: string) => {
  const octokit = await getOctokit();
  const { owner, repo, pull_number } = parsePullRequestUrl(url);
  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number });
  const body = pr.data.body;

  if (body) {
    const newBody = await getUpdatedBody(body);

    try {
      const response = await octokit.pulls.update({
        owner,
        repo,
        pull_number,
        body: newBody,
      });
      console.log('Pull request body updated:', response.data);
    } catch (error) {
      console.error('Error updating pull request body:', error);
      throw error;
    }
  }
};

const getUpdatedBody = async (body: string) => {
  const abIds = extractIds(body);
  let updatedBody = body;

  if (body && abIds.length) {
    const items = await getWorkItems(abIds);
    const titleMap = items.reduce<Record<number, string>>((acc, item) => {
      if (item.id) {
        const title = item.fields?.['System.Title'];
        const workItemType = item.fields?.['System.WorkItemType'];
        acc[item.id] = `${workItemType ? `[${workItemType}] ` : ''}${title}`;
      }
      return acc;
    }, {});
    updatedBody = appendTaskTitle(body, titleMap);
  }

  return updatedBody;
};

const parsePullRequestUrl = (url: string) => {
  const regex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error(`Invalid pull request URL: ${url}`);
  }

  return {
    owner: match[1],
    repo: match[2],
    pull_number: parseInt(match[3], 10),
  };
};

const extractIds = (text: string) => {
  const matches = text.matchAll(AB_PATTERN);
  return [...matches].map(([_match, id]) => Number(id));
};

const appendTaskTitle = (text: string, titleMap: Record<string, string>) => {
  return text.replace(AB_PATTERN, (match, id) => `${match} - ${titleMap[id]}`);
};
