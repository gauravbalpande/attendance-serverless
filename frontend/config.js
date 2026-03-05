// API base URL - Set in config.env.js at deploy, or via ?api=URL query param
const urlParams = new URLSearchParams(window.location.search);
const CONFIG = {
  API_BASE: urlParams.get('api') || window.API_BASE || 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/Prod',
  AWS_REGION: urlParams.get('region') || window.AWS_REGION || 'us-east-1',
  COGNITO_USER_POOL_ID: urlParams.get('userPoolId') || window.COGNITO_USER_POOL_ID || '',
  COGNITO_USER_POOL_CLIENT_ID: urlParams.get('clientId') || window.COGNITO_USER_POOL_CLIENT_ID || '',
};
