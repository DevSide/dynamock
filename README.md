⚠️ NOT PRODUCTION READY ⚠️

# fixture-server

[![Build Status](https://travis-ci.com/DevSide/fixture-server.svg?branch=master)](https://travis-ci.com/DevSide/fixture-server)
[![Coverage Status](https://coveralls.io/repos/github/DevSide/fixture-server/badge.svg?branch=master)](https://coveralls.io/github/DevSide/fixture-server?branch=master)

## Install

```bash
yarn add fixture-server
# or NPM
npm install fixture-server
```

## Usage

WIP

## Properties matching

WIP

## Api

### Configuration

Using the configuration is optional. However it gives the ability of reusing redundant data across requests and simplifying fixtures setup.

#### <img src="https://img.shields.io/badge/GET-61affe.svg" alt="GET" /> /\_\_\_config - **Retrieve configuration**

**Responses**

- Status 200 - OK

```json
{
  "headers": "{object} - Dictionary of headers (string) by name (string)",
  "query": "{object} - Dictionary of query (string) by name (string)",
  "cookies": "{object} - Dictionary of cookies (string) by name (string)"
}
```

Example:

```json
{
  "headers": {},
  "query": {},
  "cookies": {}
}
```

#### <img src="https://img.shields.io/badge/PUT-fca130.svg" alt="PUT" /> /\_\_\_config - **Update configuration**

**Request**

- Body

```json
{
  "headers": "{object} [default={}] - Dictionary of headers (string) by name (string)",
  "query": "{object} [default={}] - Dictionary of query (string) by name (string)",
  "cookies": "{object} [default={}] - Dictionary of cookies (string) by name (string)"
}
```

Example:

```json
{
  "headers": {
    "apiBearer": {
      "Authorization": "Bearer xyz"
    }
  }
}
```

**Responses**

- Status 200 - OK

```json
{
  "headers": "{object}",
  "query": "{object}",
  "cookies": "{object}"
}
```

Example:

```json
{
  "headers": {
    "captcha": {
      "X-CAPTCHA-TOKEN": "fake"
    },
    "cors": {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*"
    }
  },
  "query": {
    "campaign": {
      "utm_source": "x",
      "utm_campaign": "y"
    }
  },
  "cookies": {
    "anonymousUser": {
      "PHPSESSID": "x"
    },
    "loggedInUser": {
      "PHPSESSID": "y"
    }
  }
}
```

- Status 400 - BAD REQUEST

```
Wrong configuration format
```

<br/>

#### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_config - **Reset configuration**

**Responses**

- Status 204 - NO CONTENT

### Fixtures

The fixtures are composed of:

- request data to match the incoming requests
- response data when a match occurred

<br/>

#### <img src="https://img.shields.io/badge/POST-49cc90.svg" alt="POST" /> /\_\_\_fixtures - **Add fixture**

**Request**

- Body

```json
{
  "request": {
    "route": {
      "path": "{string} - Http path to match requests",
      "method": "{string} - Http method to match requests"
    },
    "headers": "{object} [default={}] - Headers to match requests",
    "params": "{object} [default={}] - Params to match requests",
    "query": "{object} [default={}] - Query to match requests",
    "cookies": "{object} [default={}] - Cookies to match requests",
    "body": "{object} [default=``] - Body to match requests"
  },
  "response": {
    "status": "{number} [default=200] - Response status code",
    "headers": "{object} [default={}] - Response headers",
    "cookies": "{object} [default={}] - Response cookies",
    "body": "{string|object|array} [default=``] - Body to match requests",
    "filepath": "{string} [default=``] - Filepath to serve with auto mime-types"
  }
}
```

Examples:

```json
{
  "request": {
    "route": {
      "path": "/pandas",
      "method": "get"
    }
  },
  "response": {
    "body": [{ "id": "1" }, { "id": "2" }]
  }
}
```

```json
{
  "request": {
    "route": {
      "path": "/cdn/images/fennec.jpg",
      "method": "get"
    }
  },
  "response": {
    "filepath": "/absolute/path/tofennec.jpg"
  }
}
```

_Responses_

- Status 200 - OK

```json
{
  "id": "{string}"
}
```

Example:

```json
{
  "id": "_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508"
}
```

- Status 400 - BAD REQUEST

```
Path or method are not provided
```

```
${PROPERTY} group named "${VALUE}" is not in the configuration
```

```
${PROPERTY} "${VALUE}" should be an object or a configuration header group name.
```

```
${PROPERTY} should be an array or an object
```

- Status 409 - CONFLICT

```
Route {METHOD} ${PATH} is already registered.
```

<br/>

#### <img src="https://img.shields.io/badge/POST-49cc90.svg" alt="POST" /> /\_\_\_fixtures/bulk - **Bulk add fixtures**

It is meant to setup multiple fixtures at once.

**Request**

- Body

```json
[
  {
    "request": {
      "route": {
        "path": "{string} - Http path to match requests",
        "method": "{string} - Http method to match requests"
      },
      "headers": "{object} [default={}] - Headers to match requests",
      "params": "{object} [default={}] - Params to match requests",
      "query": "{object} [default={}] - Query to match requests",
      "cookies": "{object} [default={}] - Cookies to match requests",
      "body": "{object} [default=``] - Body to match requests"
    },
    "response": {
      "status": "{number} [default=200] - Response status code",
      "headers": "{object} [default={}] - Response headers",
      "cookies": "{object} [default={}] - Response cookies",
      "body": "{string|object|array} [default=``] - Body to match requests",
      "filepath": "{string} [default=``] - Filepath to serve with auto mime-types"
    }
  }
]
```

Examples:

```json
[
  {
    "request": {
      "route": {
        "path": "/pandas",
        "method": "get"
      }
    },
    "response": {
      "body": [{ "id": "1" }, { "id": "2" }]
    }
  },
  {
    "request": {
      "route": {
        "path": "/cdn/images/fennec.jpg",
        "method": "get"
      }
    },
    "response": {
      "filepath": "/absolute/path/tofennec.jpg"
    }
  }
]
```

- Status 200 - OK

```json
[
  {
    "id": "{string}"
  }
]
```

Example:

```json
[
  {
    "id": "_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508"
  },
  {
    "id": "_086c67ef89fd832deeae33b209e6e8ecc6b32003"
  }
]
```

- Status 400 - BAD REQUEST

```
Path or method are not provided
```

```
${PROPERTY} group named "${VALUE}" is not in the configuration
```

```
${PROPERTY} "${VALUE}" should be an object or a configuration header group name.
```

```
${PROPERTY} should be an array or an object
```

- Status 409 - CONFLICT

```
Route {METHOD} ${PATH} is already registered.
```

<br/>

#### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_fixtures/:id - **Delete a fixture**

**Request**

- Params

```json
{
  "id": "{string}"
}
```

Example:

```
    DELETE /___fixtures/_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508
```

**Responses**

- Status 204 - NO CONTENT

<br/>

#### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_fixtures - **Delete all fixtures**

**Responses**

- Status 204 - NO CONTENT
