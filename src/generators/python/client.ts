import { PlainSDKConfig } from '../../types';
import { formatResourceName } from '../../utils/formatter';

/**
 * Generate Python client class
 * 
 * @param packageName - Name of the Python package
 * @param config - PlainSDK configuration
 * @returns Generated Python client class content
 */
export async function generatePythonClient(
  packageName: string,
  config: PlainSDKConfig
): Promise<string> {
  return `"""
Client for the ${config.name} SDK
"""
from typing import Dict, Optional, Any

from .core.config import Configuration
from .core.auth import Authentication

class Client:
    """
    Client for the ${config.name} SDK
    """
    def __init__(
        self,
        base_url: str = "https://api.example.com",
        api_key: Optional[str] = None,
        token: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize the client
        
        Args:
            base_url: Base URL for API requests
            api_key: API key for authentication
            token: Bearer token for authentication
            **kwargs: Additional configuration options
        """
        self.config = Configuration(
            base_url=base_url,
            api_key=api_key,
            token=token,
            **kwargs
        )
        self.auth = Authentication(self.config.__dict__)
        
        # Initialize API clients
        # This would be populated with API clients for each resource
`;
}

/**
 * Generate Python setup.py file
 * 
 * @param packageName - Name of the Python package
 * @param config - PlainSDK configuration
 * @returns Generated setup.py content
 */
export async function generatePythonSetupPy(
  packageName: string,
  config: PlainSDKConfig
): Promise<string> {
  return `from setuptools import setup, find_packages

setup(
    name="${packageName}",
    version="${config.version}",
    description="${config.description || `Python SDK for ${config.name}`}",
    packages=find_packages(),
    install_requires=[
        "requests>=2.25.0",
        "python-dateutil>=2.8.0",
    ],
    python_requires=">=3.7",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
`;
}

/**
 * Generate Python __init__.py files
 * 
 * @param modelDefinitions - Model definitions
 * @param packageName - Name of the Python package
 * @param config - PlainSDK configuration
 * @returns Generated __init__.py files
 */
export async function generatePythonInitFiles(
  modelDefinitions: any,
  packageName: string,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  
  // Root __init__.py
  files[`${packageName}/__init__.py`] = `"""
${config.name} Python SDK
Generated with PlainSDK
"""

from .client import Client

__all__ = ['Client']
`;

  // Models __init__.py
  const modelNames = Object.keys(modelDefinitions).map(name => 
    formatResourceName(name, config.naming.modelStyle)
  );
  
  const modelsInitContent = modelNames.map(name => {
    const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    return `from .${snakeName} import ${name}`;
  }).join('\n') + '\n\n__all__ = ' + JSON.stringify(modelNames);
  
  files[`${packageName}/models/__init__.py`] = modelsInitContent;
  
  // API __init__.py
  files[`${packageName}/api/__init__.py`] = '# API client modules\n';
  
  // Core __init__.py
  files[`${packageName}/core/__init__.py`] = '# Core modules\n';
  
  return files;
}

/**
 * Get a valid Python package name from the SDK name
 * 
 * @param name - SDK name
 * @returns Valid Python package name
 */
export function getPackageName(name: string): string {
  // Remove scopes and convert to snake_case
  return name.replace(/^@[^/]+\//, '')
    .replace(/[-@/]/g, '_')
    .toLowerCase();
}