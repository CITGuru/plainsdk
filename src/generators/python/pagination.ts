import { PlainSDKConfig } from '../../types';

/**
 * Generate pagination module for Python SDK
 * 
 * @param paginationConfig - Pagination configuration
 * @param packageName - Python package name
 * @param config - PlainSDK configuration
 * @returns Generated pagination files
 */
export async function generatePythonPagination(
  paginationConfig: any,
  packageName: string,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // If no pagination config, return default implementation
  if (!paginationConfig) {
    return {
      [`${packageName}/core/pagination.py`]: generateDefaultPagination()
    };
  }
  
  // Generate pagination module based on configuration
  const paginationContent = generatePaginationClass(paginationConfig);
  
  return {
    [`${packageName}/core/pagination.py`]: paginationContent
  };
}

/**
 * Generate default pagination module
 * 
 * @returns Default pagination module content
 */
function generateDefaultPagination(): string {
  return `"""
Pagination utilities for API requests
"""
from typing import Dict, List, Optional, Any, Callable, Iterator, TypeVar, Generic

T = TypeVar('T')


class PaginationHandler:
    """
    Handles pagination for API requests
    """
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize pagination handler
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
    
    def paginate(self, request_fn: Callable[..., Dict[str, Any]], **kwargs) -> Iterator[List[T]]:
        """
        Paginate through all results of a request
        
        Args:
            request_fn: Function to make request
            **kwargs: Additional arguments for the request
        
        Yields:
            List of items from each page
        """
        params = kwargs.get('params', {})
        has_more = True
        
        while has_more:
            # Make request with current parameters
            response = request_fn(**kwargs)
            
            # Yield data from response
            if 'data' in response:
                yield response['data']
            else:
                yield response
                
            # Check if there are more pages
            has_more = False
`;
}

/**
 * Generate pagination class based on configuration
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Pagination class content
 */
function generatePaginationClass(paginationConfig: any): string {
  const style = paginationConfig.style || 'cursor';
  
  let content = `"""
Pagination utilities for API requests
"""
from typing import Dict, List, Optional, Any, Callable, Iterator, TypeVar, Generic

T = TypeVar('T')


class PaginationHandler:
    """
    Handles pagination for API requests
    Pagination style: ${style}
    """
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize pagination handler
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
    
    def paginate(self, request_fn: Callable[..., Dict[str, Any]], **kwargs) -> Iterator[List[T]]:
        """
        Paginate through all results of a request
        
        Args:
            request_fn: Function to make request
            **kwargs: Additional arguments for the request
        
        Yields:
            List of items from each page
        """
        params = kwargs.get('params', {}).copy() if 'params' in kwargs else {}
        kwargs['params'] = params
        has_more = True
        
`;

  // Add pagination logic based on style
  switch (style) {
    case 'cursor':
      content += generateCursorPagination(paginationConfig);
      break;
    case 'offset':
      content += generateOffsetPagination(paginationConfig);
      break;
    case 'page':
      content += generatePagePagination(paginationConfig);
      break;
    case 'token':
      content += generateTokenPagination(paginationConfig);
      break;
    default:
      // Default to cursor pagination
      content += generateCursorPagination(paginationConfig);
  }

  return content;
}

/**
 * Generate cursor-based pagination
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Cursor pagination implementation
 */
function generateCursorPagination(paginationConfig: any): string {
  const limitParam = paginationConfig.parameters?.limit || 'limit';
  const cursorParam = paginationConfig.parameters?.cursor || 'cursor';
  const nextCursorField = paginationConfig.responseFields?.nextCursor || 'next_cursor';
  const hasMoreField = paginationConfig.responseFields?.hasMore || 'has_more';
  
  return `        while has_more:
            # Make request with current parameters
            response = request_fn(**kwargs)
            
            # Yield data from response
            if 'data' in response:
                yield response['data']
            else:
                yield response
                
            # Check if there are more pages
            if '${nextCursorField}' in response and response['${nextCursorField}']:
                # Update cursor for next page
                params['${cursorParam}'] = response['${nextCursorField}']
                has_more = True
            elif '${hasMoreField}' in response:
                # Check has_more flag
                has_more = response['${hasMoreField}']
            else:
                # No pagination info, stop
                has_more = False
`;
}

/**
 * Generate offset-based pagination
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Offset pagination implementation
 */
function generateOffsetPagination(paginationConfig: any): string {
  const limitParam = paginationConfig.parameters?.limit || 'limit';
  const offsetParam = paginationConfig.parameters?.offset || 'offset';
  const totalCountField = paginationConfig.responseFields?.totalCount || 'total_count';
  
  return `        # Set default limit if not provided
        limit = params.get('${limitParam}', 20)
        offset = params.get('${offsetParam}', 0)
        
        while has_more:
            # Set current offset
            params['${offsetParam}'] = offset
            
            # Make request with current parameters
            response = request_fn(**kwargs)
            
            # Get data from response
            data = response.get('data', response)
            
            # Yield data
            yield data
            
            # Check if there are more pages
            if '${totalCountField}' in response:
                # Check against total count
                total_count = response['${totalCountField}']
                next_offset = offset + limit
                has_more = next_offset < total_count
            elif isinstance(data, list):
                # Check if we got a full page
                has_more = len(data) >= limit
            else:
                # No pagination info, stop
                has_more = False
            
            # Update offset for next page
            offset += limit
`;
}

/**
 * Generate page-based pagination
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Page pagination implementation
 */
function generatePagePagination(paginationConfig: any): string {
  const limitParam = paginationConfig.parameters?.limit || 'limit';
  const pageParam = paginationConfig.parameters?.page || 'page';
  const totalPagesField = paginationConfig.responseFields?.totalPages || 'total_pages';
  
  return `        # Set default page if not provided
        page = params.get('${pageParam}', 1)
        
        while has_more:
            # Set current page
            params['${pageParam}'] = page
            
            # Make request with current parameters
            response = request_fn(**kwargs)
            
            # Get data from response
            data = response.get('data', response)
            
            # Yield data
            yield data
            
            # Check if there are more pages
            if '${totalPagesField}' in response:
                # Check against total pages
                total_pages = response['${totalPagesField}']
                next_page = page + 1
                has_more = next_page <= total_pages
            elif isinstance(data, list) and data:
                # If we get data, continue to next page
                has_more = True
            else:
                # No pagination info or no data, stop
                has_more = False
            
            # Update page for next request
            page += 1
`;
}

/**
 * Generate token-based pagination
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Token pagination implementation
 */
function generateTokenPagination(paginationConfig: any): string {
  const limitParam = paginationConfig.parameters?.limit || 'limit';
  const tokenParam = paginationConfig.parameters?.cursor || 'token';
  const nextTokenField = paginationConfig.responseFields?.nextToken || 'next_token';
  const hasMoreField = paginationConfig.responseFields?.hasMore || 'has_more';
  
  return `        while has_more:
            # Make request with current parameters
            response = request_fn(**kwargs)
            
            # Yield data from response
            if 'data' in response:
                yield response['data']
            else:
                yield response
                
            # Check if there are more pages
            if '${nextTokenField}' in response and response['${nextTokenField}']:
                # Update token for next page
                params['${tokenParam}'] = response['${nextTokenField}']
                has_more = True
            elif '${hasMoreField}' in response:
                # Check has_more flag
                has_more = response['${hasMoreField}']
            else:
                # No pagination info, stop
                has_more = False
`;
}