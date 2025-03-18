import { PlainSDKConfig } from '../../types';

/**
 * Generate pagination module for TypeScript SDK
 * 
 * @param paginationConfig - Pagination configuration
 * @param config - PlainSDK configuration
 * @returns Generated pagination files
 */
export async function generatePagination(
  paginationConfig: any,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // If no pagination config, return default implementation
  if (!paginationConfig) {
    return {
      'src/core/pagination.ts': generateDefaultPagination()
    };
  }
  
  // Generate pagination module based on configuration
  const paginationContent = generatePaginationModule(paginationConfig);
  
  return {
    'src/core/pagination.ts': paginationContent
  };
}

/**
 * Generate default pagination module
 * 
 * @returns Default pagination module content
 */
function generateDefaultPagination(): string {
  return `import { AxiosRequestConfig } from 'axios';
import { Configuration } from './types';

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /**
   * Data items
   */
  data: T[];
  
  /**
   * Next cursor for pagination
   */
  nextCursor?: string;
  
  /**
   * Whether there are more items
   */
  hasMore?: boolean;
  
  /**
   * Total number of items
   */
  totalCount?: number;
  
  /**
   * Current page number
   */
  page?: number;
  
  /**
   * Total number of pages
   */
  totalPages?: number;
  
  /**
   * Next page number
   */
  nextPage?: number;
}

/**
 * Pagination handler for API requests
 */
export class PaginationHandler {
  private readonly config: Configuration;
  
  /**
   * Create a pagination handler
   * @param config - API configuration
   */
  constructor(config: Configuration) {
    this.config = config;
  }
  
  /**
   * Paginate through all results of a request
   * @param requestFn - Function to make a request
   * @param initialParams - Initial request parameters
   * @returns Async generator of paginated responses
   */
  public async *paginate<T>(
    requestFn: (params: Record<string, any>) => Promise<PaginatedResponse<T>>,
    initialParams: Record<string, any> = {}
  ): AsyncGenerator<T[]> {
    let params = { ...initialParams };
    let hasMore = true;
    
    while (hasMore) {
      const response = await requestFn(params);
      
      // Yield results
      yield response.data;
      
      // Check if there are more pages
      hasMore = Boolean(response.nextCursor || response.hasMore || 
                       (response.nextPage && response.nextPage <= (response.totalPages || Infinity)));
      
      if (!hasMore) {
        break;
      }
      
      // Update parameters for next page
      if (response.nextCursor) {
        params = {
          ...params,
          cursor: response.nextCursor,
        };
      } else if (response.nextPage) {
        params = {
          ...params,
          page: response.nextPage,
        };
      } else if (typeof params.page === 'number') {
        params = {
          ...params,
          page: (params.page || 1) + 1,
        };
      } else if (typeof params.offset === 'number') {
        const limit = params.limit || 20;
        params = {
          ...params,
          offset: (params.offset || 0) + limit,
        };
      } else {
        // Can't determine how to get next page
        break;
      }
    }
  }
}
`;
}

// /**
//  * Generate pagination module based on configuration
//  * 
//  * @param paginationConfig - Pagination configuration
//  * @returns Pagination module content
//  */
// function generatePaginationModule(paginationConfig: any): string {
//   const style = paginationConfig.style || 'cursor';
  
//   // Define pagination interface
//   let content = `import { AxiosRequestConfig } from 'axios';
// import { Configuration } from './types';

// /**
//  * Paginated response
//  */
// export interface PaginatedResponse<T> {
//   /**
//    * Data items
//    */
//   data: T[];
// `;
  
//   // Add fields based on pagination style
//   if (style === 'cursor' || style === 'token') {
//     const nextCursorField = paginationConfig.responseFields?.nextCursor || 'next_cursor';
//     const hasMoreField = paginationConfig.responseFields?.hasMore || 'has_more';
    
//     content += `  
//   /**
//    * Next cursor for pagination
//    */
//   ${style === 'cursor' ? 'nextCursor' : 'nextToken'}?: string;
  
//   /**
//    * Whether there are more items
//    */
//   hasMore?: boolean;
// `;
//   } else if (style === 'offset') {
//     const totalCountField = paginationConfig.responseFields?.totalCount || 'total_count';
    
//     content += `  
//   /**
//    * Total number of items
//    */
//   totalCount?: number;
  
//   /**
//    * Current offset
//    */
//   offset?: number;
  
//   /**
//    * Number of items per page
//    */
//   limit?: number;
// `;
//   } else if (style === 'page') {
//     const totalPagesField = paginationConfig.responseFields?.totalPages || 'total_pages';
//     const totalCountField = paginationConfig.responseFields?.totalCount || 'total_count';
    
//     content += `  
//   /**
//    * Total number of pages
//    */
//   totalPages?: number;
  
//   /**
//    * Total number of items
//    */
//   totalCount?: number;
  
//   /**
//    * Current page number
//    */
//   page?: number;
  
//   /**
//    * Number of items per page
//    */
//   pageSize?: number;
  
//   /**
//    * Next page number
//    */
//   nextPage?: number;
  
//   /**
//    * Previous page number
//    */
//   prevPage?: number;
// `;
//   }
  
//   content += `}

// /**
//  * Pagination handler for API requests
//  */
// export class PaginationHandler {
//   private readonly config: Configuration;
  
//   /**
//    * Create a pagination handler
//    * @param config - API configuration
//    */
//   constructor(config: Configuration) {
//     this.config = config;
//   }
  
//   /**
//    * Paginate through all results of a request
//    * @param requestFn - Function to make a request
//    * @param initialParams - Initial request parameters
//    * @returns Async generator of paginated responses
//    */
//   public async *paginate<T>(
//     requestFn: (params: Record<string, any>) => Promise<PaginatedResponse<T>>,
//     initialParams: Record<string, any> = {}
//   ): AsyncGenerator<T[]> {
//     let params = { ...initialParams };
//     let hasMore = true;
    
//     while (hasMore) {
//       const response = await requestFn(params);
      
//       // Yield results
//       yield response.data;
      
//       // Update params and check if there are more pages
//       [params, hasMore] = this.getNextPageParams(response, params);
      
//       if (!hasMore) {
//         break;
//       }
//     }
//   }
  
//   /**
//    * Get parameters for the next page
//    * @param response - Current response
//    * @param currentParams - Current parameters
//    * @returns Parameters for the next page and whether there are more pages
//    */
//   private getNextPageParams<T>(
//     response: PaginatedResponse<T>,
//     currentParams: Record<string, any>
//   ): [Record<string, any>, boolean] {
// `;
  
//   // Add pagination logic based on style
//   switch (style) {
//     case 'cursor':
//       content += generateCursorPagination(paginationConfig);
//       break;
//     case 'offset':
//       content += generateOffsetPagination(paginationConfig);
//       break;
//     case 'page':
//       content += generatePagePagination(paginationConfig);
//       break;
//     case 'token':
//       content += generateTokenPagination(paginationConfig);
//       break;
//     default:
//       content += generateCursorPagination(paginationConfig);
//   }
  
//   content += `  }
// }
// `;
  
//   return content;
// }

/**
 * Generate cursor pagination logic
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Cursor pagination implementation
 */
function generateCursorPagination(paginationConfig: any): string {
  const cursorParam = paginationConfig.parameters?.cursor || 'cursor';
  
  return `    // Check if there are more pages
    const hasMore = response.hasMore || Boolean(response.nextCursor);
    
    if (!hasMore) {
      return [currentParams, false];
    }
    
    // Update cursor parameter
    const nextParams = { ...currentParams };
    nextParams['${cursorParam}'] = response.nextCursor;
    
    return [nextParams, true];`;
}

/**
 * Generate offset pagination logic
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Offset pagination implementation
 */
function generateOffsetPagination(paginationConfig: any): string {
  const offsetParam = paginationConfig.parameters?.offset || 'offset';
  const limitParam = paginationConfig.parameters?.limit || 'limit';
  
  return `    const limit = currentParams['${limitParam}'] || 20;
    const offset = currentParams['${offsetParam}'] || 0;
    const nextOffset = offset + limit;
    
    // Check if there are more pages
    const hasMore = response.totalCount ? nextOffset < response.totalCount : response.data.length >= limit;
    
    if (!hasMore) {
      return [currentParams, false];
    }
    
    // Update offset parameter
    const nextParams = { ...currentParams };
    nextParams['${offsetParam}'] = nextOffset;
    
    return [nextParams, true];`;
}

/**
 * Generate page pagination logic
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Page pagination implementation
 */
function generatePagePagination(paginationConfig: any): string {
  const pageParam = paginationConfig.parameters?.page || 'page';
  
  return `    const currentPage = currentParams['${pageParam}'] || 1;
    let nextPage = currentPage + 1;
    
    // Use nextPage from response if available
    if (response.nextPage !== undefined) {
      nextPage = response.nextPage;
    }
    
    // Check if there are more pages
    let hasMore = false;
    
    if (response.totalPages) {
      hasMore = nextPage <= response.totalPages;
    } else if (response.totalCount) {
      const pageSize = currentParams.pageSize || response.pageSize || response.data.length;
      hasMore = (currentPage * pageSize) < response.totalCount;
    } else {
      hasMore = response.data.length > 0;
    }
    
    if (!hasMore) {
      return [currentParams, false];
    }
    
    // Update page parameter
    const nextParams = { ...currentParams };
    nextParams['${pageParam}'] = nextPage;
    
    return [nextParams, true];`;
}

/**
 * Generate token pagination logic
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Token pagination implementation
 */
function generateTokenPagination(paginationConfig: any): string {
  const tokenParam = paginationConfig.parameters?.cursor || 'token';
  
  return `    // Check if there are more pages
    const hasMore = response.hasMore || Boolean(response.nextToken);
    
    if (!hasMore) {
      return [currentParams, false];
    }
    
    // Update token parameter
    const nextParams = { ...currentParams };
    nextParams['${tokenParam}'] = response.nextToken;
    
    return [nextParams, true];`;
}


/**
 * Generate pagination module based on configuration
 * 
 * @param paginationConfig - Pagination configuration
 * @returns Pagination module content
 */
function generatePaginationModule(paginationConfig: any): string {
  const style = paginationConfig.style || 'cursor';
  
  // Define pagination interface
  let content = `import { AxiosRequestConfig } from 'axios';
import { Configuration } from './types';

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /**
   * Data items
   */
  data: T[];
`;
  
  // Add fields based on pagination style
  if (style === 'cursor' || style === 'token') {
    const nextCursorField = paginationConfig.responseFields?.nextCursor || 'next_cursor';
    const hasMoreField = paginationConfig.responseFields?.hasMore || 'has_more';
    
    content += `  
  /**
   * Next cursor for pagination
   */
  ${style === 'cursor' ? 'nextCursor' : 'nextToken'}?: string;
  
  /**
   * Whether there are more items
   */
  hasMore?: boolean;
`;
  } else if (style === 'offset') {
    const totalCountField = paginationConfig.responseFields?.totalCount || 'total_count';
    
    content += `  
  /**
   * Total number of items
   */
  totalCount?: number;
  
  /**
   * Current offset
   */
  offset?: number;
  
  /**
   * Number of items per page
   */
  limit?: number;
`;
  } else if (style === 'page') {
    const totalPagesField = paginationConfig.responseFields?.totalPages || 'total_pages';
    const totalCountField = paginationConfig.responseFields?.totalCount || 'total_count';
    
    content += `  
  /**
   * Total number of pages
   */
  totalPages?: number;
  
  /**
   * Total number of items
   */
  totalCount?: number;
  
  /**
   * Current page number
   */
  page?: number;
  
  /**
   * Number of items per page
   */
  pageSize?: number;
  
  /**
   * Next page number
   */
  nextPage?: number;
  
  /**
   * Previous page number
   */
  prevPage?: number;
`;
  }
  
  content += `}

/**
 * Pagination handler for API requests
 */
export class PaginationHandler {
  private readonly config: Configuration;
  
  /**
   * Create a pagination handler
   * @param config - API configuration
   */
  constructor(config: Configuration) {
    this.config = config;
  }
  
  /**
   * Paginate through all results of a request
   * @param requestFn - Function to make a request
   * @param initialParams - Initial request parameters
   * @returns Async generator of paginated responses
   */
  public async *paginate<T>(
    requestFn: (params: Record<string, any>) => Promise<PaginatedResponse<T>>,
    initialParams: Record<string, any> = {}
  ): AsyncGenerator<T[]> {
    let params = { ...initialParams };
    let hasMore = true;
    
    while (hasMore) {
      const response = await requestFn(params);
      
      // Yield results
      yield response.data;
      
      // Update params and check if there are more pages
      [params, hasMore] = this.getNextPageParams(response, params);
      
      if (!hasMore) {
        break;
      }
    }
  }
  
  /**
   * Get parameters for the next page
   * @param response - Current response
   * @param currentParams - Current parameters
   * @returns Parameters for the next page and whether there are more pages
   */
  private getNextPageParams<T>(
    response: PaginatedResponse<T>,
    currentParams: Record<string, any>
  ): [Record<string, any>, boolean] {
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
      content += generateCursorPagination(paginationConfig);
  }
  
  content += `  }
}
`;
  
  return content;
}

// /**
//  * Generate cursor pagination logic
//  * 
//  * @param paginationConfig - Pagination configuration
//  * @returns Cursor pagination implementation
//  */
// function generateCursorPagination(paginationConfig: any): string {
//   const cursorParam = paginationConfig.parameters?.cursor || 'cursor';
  
//   return `    // Check if there are more pages
//     const hasMore = response.hasMore || Boolean(response.nextCursor);
    
//     if (!hasMore) {
//       return [currentParams, false];
//     }
    
//     // Update cursor parameter
//     const nextParams = { ...currentParams };
//     nextParams['${cursorParam}'] = response.nextCursor;
    
//     return [nextParams, true];`;
// }

// /**
//  * Generate offset pagination logic
//  * 
//  * @param paginationConfig - Pagination configuration
//  * @returns Offset pagination implementation
//  */
// function generateOffsetPagination(paginationConfig: any): string {
//   const offsetParam = paginationConfig.parameters?.offset || 'offset';
//   const limitParam = paginationConfig.parameters?.limit || 'limit';
  
//   return `    const limit = currentParams['${limitParam}'] || 20;
//     const offset = currentParams['${offsetParam}'] || 0;
//     const nextOffset = offset + limit;
    
//     // Check if there are more pages
//     const hasMore = response.totalCount ? nextOffset < response.totalCount : response.data.length >= limit;
    
//     if (!hasMore) {
//       return [currentParams, false];
//     }
    
//     // Update offset parameter
//     const nextParams = { ...currentParams };
//     nextParams['${offsetParam}'] = nextOffset;
    
//     return [nextParams, true];`;
// }

// /**
//  * Generate page pagination logic
//  * 
//  * @param paginationConfig - Pagination configuration
//  * @returns Page pagination implementation
//  */
// function generatePagePagination(paginationConfig: any): string {
//   const pageParam = paginationConfig.parameters?.page || 'page';
  
//   return `    const currentPage = currentParams['${pageParam}'] || 1;
//     let nextPage = currentPage + 1;
    
//     // Use nextPage from response if available
//     if (response.nextPage !== undefined) {
//       nextPage = response.nextPage;
//     }
    
//     // Check if there are more pages
//     let hasMore = false;
    
//     if (response.totalPages) {
//       hasMore = nextPage <= response.totalPages;
//     } else if (response.totalCount) {
//       const pageSize = currentParams.pageSize || response.pageSize || response.data.length;
//       hasMore = (currentPage * pageSize) < response.totalCount;
//     } else {
//       hasMore = response.data.length > 0;
//     }
    
//     if (!hasMore) {
//       return [currentParams, false];
//     }
    
//     // Update page parameter
//     const nextParams = { ...currentParams };
//     nextParams['${pageParam}'] = nextPage;
    
//     return [nextParams, true];`;
// }

// /**
//  * Generate token pagination logic
//  * 
//  * @param paginationConfig - Pagination configuration
//  * @returns Token pagination implementation
//  */
// function generateTokenPagination(paginationConfig: any): string {
//   const tokenParam = paginationConfig.parameters?.cursor || 'token';
  
//   return `    // Check if there are more pages
//     const hasMore = response.hasMore || Boolean(response.nextToken);
    
//     if (!hasMore) {
//       return [currentParams, false];
//     }
    
//     // Update token parameter
//     const nextParams = { ...currentParams };
//     nextParams['${tokenParam}'] = response.nextToken;
    
//     return [nextParams, true];`;
// }