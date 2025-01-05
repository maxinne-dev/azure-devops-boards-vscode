import type { GitHubPullRequest } from '../interfaces';
import { getSettings } from '../utils';

/**
 * Undocumented API
 *
 * @see https://github.com/dc-ag/azure-devops-pr-notification/blob/fcb9cd24ffbcc2dbe81a7500a3d5577213afa7e3/src/main.ts
 * @see https://github.com/marketplace/actions/azure-devops-commit-validator-and-pull-request-linker#how-the-commit--pull-request-linking-in-azure-devops-works
 */
export const getGithubArtifact = async (
  workItemId: number,
  pullRequestArtifactUrls: string[],
): Promise<GitHubPullRequest[] | undefined> => {
  const { adoPersonalAccessToken, serverUrl } = getSettings();
  const dataProviderUrl = `${serverUrl}/_apis/Contribution/dataProviders/query?api-version=7.1-preview.1`;
  const msGitHubLinkDataProviderLink = 'ms.vss-work-web.github-link-data-provider';
  const prLinkRegex = new RegExp(
    '\\/GitHub\\/PullRequest\\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})%2f([0-9]*)',
    'i',
  );

  const prIdentifierList = [];
  for (const url of pullRequestArtifactUrls) {
    let prLinkRegResult = url.match(prLinkRegex);
    if (prLinkRegResult) {
      prIdentifierList.push({
        itemType: 1, // pullRequest
        numberOrSHA: prLinkRegResult[2],
        repoInternalId: prLinkRegResult[1],
      });
    }
  }

  const response = await fetch(dataProviderUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(':' + adoPersonalAccessToken).toString('base64')}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      context: {
        properties: { workItemId, identifiers: prIdentifierList },
      },
      contributionIds: [msGitHubLinkDataProviderLink],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `\n--- getGithubArtifact() failed ---\n${JSON.stringify(
        {
          status: response.status,
          parameter: { workItemId, pullRequestArtifactUrls },
          statusText: await response.json(),
        },
        null,
        2,
      )}`,
    );
  }

  const result = (await response.json()) as any;
  const errorMsg = result?.data?.[msGitHubLinkDataProviderLink].errorMessage;
  if (errorMsg) {
    throw new Error(errorMsg);
  }

  return result?.data?.[msGitHubLinkDataProviderLink]?.resolvedLinkItems as GitHubPullRequest[];
};
