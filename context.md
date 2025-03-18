
# PlainSDK: Generating Idiomatic SDKs from OpenAPI Specs

PlainSDK is a tool designed to create high-quality, idiomatic Software Development Kits (SDKs) in various programming languages, starting with TypeScript, using an OpenAPI specification as input. Its primary goal is to simplify the process for developers by generating polished, ready-to-use SDKs, allowing them to focus on designing their APIs while PlainSDK handles the intricacies of SDK creation.

## Overview of PlainSDK

PlainSDK transforms an OpenAPI specification—a structured document that describes a RESTful API’s endpoints, operations, parameters, and data schemas—into a functional SDK. Initially targeting TypeScript, it produces code that adheres to the language’s conventions, is user-friendly, and includes features like authentication and pagination. Unlike traditional code generation tools, PlainSDK stands out by allowing developers to modify the generated code directly, with those changes preserved across regenerations when the OpenAPI spec is updated.

The process involves:

Accepting an OpenAPI spec (in JSON or YAML), even if it contains imperfections.
Utilizing a configuration file to tailor naming conventions and core functionalities.
Producing a TypeScript SDK that is extensible and idiomatic.
Ensuring user modifications persist through subsequent regenerations.

### Step 1: Inputs to PlainSDK

PlainSDK relies on two essential inputs:
OpenAPI Specification: This serves as the API’s blueprint, defining paths (e.g., /users), operations (e.g., GET, POST), parameters, and request/response schemas. PlainSDK is robust enough to handle incomplete or imperfect specs by applying reasonable defaults or assumptions.
Configuration File: A customizable file (e.g., plainsdk-config.yaml) allows developers to define preferences for the SDK, such as class names, method naming styles, authentication mechanisms, and pagination approaches.

Here’s an example configuration file in YAML:
```yaml
sdk:
  className: MyAPI
  methodNaming: camelCase

authentication:
  type: apiKey
  key: X-API-Key
  in: header

operations:
  getUsers: # Matches operationId from the spec
    pagination:
      type: offsetLimit
      offsetParam: offset
      limitParam: limit
      defaultLimit: 50
This configuration:
Names the SDK class MyAPI.
Specifies camelCase for method names (e.g., getUsers).
Configures API key authentication via the X-API-Key header.
Defines offset-limit pagination for the getUsers operation.
Step 2: Generating the TypeScript SDK
PlainSDK processes the OpenAPI spec and configuration to generate a TypeScript SDK, typically output as a single file (e.g., sdk.ts), though it could be modularized for larger projects. The generated code includes:
Types
PlainSDK creates TypeScript interfaces for each schema in the OpenAPI spec. For example, given this schema:
yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string

```

The generated TypeScript code is:

```typescript
export interface User {
  id: string;
  name: string;
}
```

### Base SDK Class
A BaseSDK class is generated, featuring methods for each API operation and designed for extensibility. Here’s an example for a GET /users endpoint:
