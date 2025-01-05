import * as vscode from 'vscode';

export const callWebHook = async (message: string, url: string, payload: any) => {
  const confirm = await vscode.window.showWarningMessage(message, 'Yes', 'No');

  if (confirm !== 'Yes') {
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const responseStatus = `${response.status} - ${response.statusText}`;

    if (!response.ok) {
      throw new Error(responseStatus);
    }

    vscode.window.showInformationMessage(`Webhook triggered successfully. ${responseStatus}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to trigger webhook: ${error} \n${url}`);
    console.error('Error:', error);
  }
};
