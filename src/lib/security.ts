import path from 'path';

/**
 * Validates if a target path is safely within the active workspace root.
 * Throws an error if path traversal is detected or if it accesses forbidden directories.
 */
export function validatePath(workspaceRoot: string, targetPath: string): string {
  if (!workspaceRoot) {
    throw new Error('No workspace directory is selected.');
  }

  // Resolve absolute paths
  const absoluteRoot = path.resolve(workspaceRoot);
  const absoluteTarget = path.resolve(targetPath);

  // Check path traversal
  if (!absoluteTarget.startsWith(absoluteRoot)) {
    throw new Error(`Security Error: Access denied. Path is outside workspace root: ${targetPath}`);
  }

  // Check for forbidden paths
  const relativePath = path.relative(absoluteRoot, absoluteTarget);
  const pathParts = relativePath.split(path.sep);

  if (
    pathParts.some((part) => part === '.git' || part === 'node_modules' || part === '.next')
  ) {
    throw new Error(`Security Error: Access denied to system files: ${targetPath}`);
  }

  return absoluteTarget;
}

/**
 * Checks if a filename or path is a sensitive config/environment file.
 */
export function isSensitiveFile(filePath: string): boolean {
  const filename = path.basename(filePath).toLowerCase();
  return (
    filename === '.env' ||
    filename.startsWith('.env.') ||
    filename === 'id_rsa' ||
    filename === 'id_ed25519' ||
    filename.endsWith('.pem') ||
    filename.endsWith('.key')
  );
}

// Regex list for detecting common API keys and secrets
const SECRET_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /private[-_]?key/i,
  /aws[-_]?access/i,
  /db[-_]?url/i,
  /database[-_]?url/i,
];

/**
 * Basic utility to check if an environment variable key is likely sensitive.
 */
export function isSensitiveKey(key: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Mask values resembling API keys, secrets, or passwords in text.
 */
export function maskSecrets(content: string): string {
  if (!content) return '';

  let maskedContent = content;

  // Mask typical .env variable values: KEY=value
  maskedContent = maskedContent.replace(
    /(DATABASE_URL|API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*=\s*(['"]?)([^'"\n\s]+)(['"]?)/gi,
    (match, key, quote1, value, quote2) => {
      if (value && value.length > 4) {
        const masked = value.slice(0, 4) + '****************';
        return `${key}=${quote1}${masked}${quote2}`;
      }
      return match;
    }
  );

  // Mask generic key-like patterns in text (e.g. sk-proj-... or AIzaSy...)
  // OpenAI key
  maskedContent = maskedContent.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***masked***');
  // Anthropic key
  maskedContent = maskedContent.replace(/sk-ant-[a-zA-Z0-9-]{30,}/g, 'sk-ant-***masked***');
  // Google API key
  maskedContent = maskedContent.replace(/AIzaSy[a-zA-Z0-9-_]{33}/g, 'AIzaSy***masked***');

  return maskedContent;
}
