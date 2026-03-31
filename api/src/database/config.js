const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '../../..');
const envFiles = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local')
];
const isAzureAppService = Boolean(
  process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME || process.env.WEBSITE_INSTANCE_ID
);

let environmentLoaded = false;

function loadDatabaseEnvironment() {
  if (environmentLoaded) {
    return;
  }

  // In Azure App Service, only host-provided App Settings should be used.
  // Ignore any .env files that may have been uploaded with the deployment package.
  if (isAzureAppService) {
    const uploadedEnvFiles = envFiles.filter(envFile => fs.existsSync(envFile));
    if (uploadedEnvFiles.length > 0) {
      console.warn('[DB Config] Ignoring uploaded env files in Azure App Service:', uploadedEnvFiles);
    }

    environmentLoaded = true;
    return;
  }

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
      continue;
    }

    dotenv.config({
      path: envFile,
      override: envFile.endsWith('.env.local')
    });
  }

  environmentLoaded = true;
}

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseConnectionString(connectionString) {
  if (!connectionString) {
    return {};
  }

  const segments = connectionString
    .split(';')
    .map(segment => segment.trim())
    .filter(Boolean);

  const values = {};
  for (const segment of segments) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim().toLowerCase();
    const value = segment.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  const serverValue = values.server || values['data source'] || '';
  const [serverPart, portPart] = serverValue.replace(/^tcp:/i, '').split(',');

  return {
    server: serverPart || undefined,
    port: parsePort(portPart) || parsePort(values.port),
    database: values.database || values['initial catalog'],
    user: values['user id'] || values.user || values.uid,
    password: values.password || values.pwd
  };
}

function getDatabaseConnectionSettings() {
  loadDatabaseEnvironment();

  const parsedConnectionString = parseConnectionString(process.env.DATABASE_CONNECTION_STRING);
  const settings = {
    server: process.env.DB_SERVER || parsedConnectionString.server,
    port: parsePort(process.env.DB_PORT) || parsedConnectionString.port || 1433,
    database: process.env.DB_NAME || parsedConnectionString.database,
    user: process.env.DB_USER || parsedConnectionString.user,
    password: process.env.DB_PASSWORD || parsedConnectionString.password
  };

  const missingKeys = Object.entries(settings)
    .filter(([key, value]) => key !== 'port' && !value)
    .map(([key]) => key.toUpperCase());

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing database configuration: ${missingKeys.join(', ')}. ` +
      'Set DB_* variables or DATABASE_CONNECTION_STRING.'
    );
  }

  return settings;
}

module.exports = {
  getDatabaseConnectionSettings,
  loadDatabaseEnvironment
};
