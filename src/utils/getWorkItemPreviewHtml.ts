import { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import { getSettings } from './getSettings';
import * as adoClient from '../services/adoService';

export const getWorkItemPreviewHtml = async (workItem: WorkItem): Promise<string> => {
  const { adoPersonalAccessToken } = getSettings();
  const id = workItem.id;
  const title = `${id} - ${workItem.fields?.['System.Title']}`;
  const body = workItem.fields?.['System.Description'];
  const acceptanceCriteria = workItem.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'];
  const commentList = id ? (await adoClient.getWorkItemComments(id)).comments : [];

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.2">
      <style>
        body { font-size: 16px; padding-bottom: 32px; }
        h2 { border-bottom: 1px solid #ccc; padding-bottom: 8px; }
        .comment { margin-left: 16px; padding-bottom: 16px; }
        .comment strong { margin-right: 4px; }
        .comment:not(:last-of-type) { border-bottom: 1px solid #ccc; }
      </style>
      <title>${title}</title>
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('img').forEach(img => {
            const url = img.getAttribute('src');
            fetch(url, {
              headers: { Authorization: 'Basic ${btoa(':' + adoPersonalAccessToken)}'}
            })
              .then(response => response.blob())
              .then(blob => {
                const objectURL = URL.createObjectURL(blob);
                img.setAttribute('src', objectURL);
              })
              .catch(error => console.error('Error loading image:', error));
          });
        });
      </script>
  </head>
  <body>
      <h1>${title}</h1>
      ${body ? `<h2>Description</h2> ${body}` : ''}
      ${acceptanceCriteria ? `<h2>Acceptance Criteria</h2> ${acceptanceCriteria}` : ''}
      <h2>Comments</h2>
      ${
        commentList
          ?.map(
            ({ renderedText, createdBy, createdDate }) =>
              `<div class="comment">
                <p>
                  <strong>${createdBy?.displayName}</strong>
                  <span>${createdDate?.toLocaleString()}</span>
                </p>
                ${renderedText}
              </div>`,
          )
          .join('') || 'No comments available'
      }
  </body>
</html>`;
};
