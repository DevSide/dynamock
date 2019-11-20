⚠️ NOT PRODUCTION READY ⚠️

# dynamock

[![npm version](https://badge.fury.io/js/dynamock.svg)](https://badge.fury.io/js/dynamock)
![David](https://img.shields.io/david/devside/dynamock)
![node](https://img.shields.io/node/v/dynamock)
[![Build Status](https://travis-ci.com/DevSide/dynamock.svg?branch=master)](https://travis-ci.com/DevSide/dynamock)
[![Coverage Status](https://coveralls.io/repos/github/DevSide/dynamock/badge.svg?branch=master)](https://coveralls.io/github/DevSide/dynamock?branch=master)

`dynamock` is a dynamic mock/fixture server designed for functional testing.

## Install

```bash
yarn add dynamock -D
# or NPM
npm install dynamock --save-dev
```

## Usage

### Run the server (NodeJS required)

```bash
# dynamock PORT [HOST]
dynamock 3001
```

### Inject fixtures

WIP

### Consume fixtures

WIP

## Property response matching

WIP

## Api

### Configuration

Using the configuration is optional. However it gives the ability of reusing redundant data across requests and simplifying fixtures setup.

#### <img src="https://img.shields.io/badge/GET-61affe.svg" alt="GET" /> /\_\_\_config - **Retrieve configuration**

**Responses**

- Status 200 - OK

```json
{
  "headers": "{object} - Dictionary of headers (object) by name (string)",
  "query": "{object} - Dictionary of query (object) by name (string)",
  "cookies": "{object} - Dictionary of cookies (object) by name (string)"
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
  "headers": "{object} [default={}] - Dictionary of headers (object) by name (string)",
  "query": "{object} [default={}] - Dictionary of query (object) by name (string)",
  "cookies": "{object} [default={}] - Dictionary of cookies (object) by name (string)"
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
    "path": "{string} - Http path to match requests, use wildcard '*' to match all",
    "method": "{string} - Http method to match requests, case insensitive, use wildcard '*' to match all",
    "headers": "{object|array} [default={}] - Headers to match requests",
    "query": "{object|array} [default={}] - Query to match requests",
    "cookies": "{object|array} [default={}] - Cookies to match requests",
    "body": "{object} [default=``] - Body to match requests",
    "options": {
      "headers": {
        "strict": "{boolean} [default=false] - Strictly match headers"
      },
      "cookies": {
        "strict": "{boolean} [default=false] - Strictly match cookies"
      },
      "query": {
        "strict": "{boolean} [default=false] - Strictly match query"
      },
      "body": {
        "strict": "{boolean} [default=false] - Strictly match body"
      }
    }
  },
  "response": {
    "status": "{number} [default=200] - Response status code",
    "headers": "{object|array} [default={}] - Response headers",
    "cookies": "{object|array} [default={}] - Response cookies",
    "body": "{string|object|array} [default=``] - Body to response",
    "filepath": "{string} [default=``] - Filepath to serve with auto mime-types",
    "options": {
      "delay": "{number} [default=0] - Delay the response with a number of milliseconds",
      "lifetime": "{number} [default=1] - Number of times the fixture can be consumed before getting removed"
    }
  },
  "responses": "{array} [default=[]] - Array of responses"
}
```

Examples:

```json
{
  "request": {
    "path": "/pandas",
    "method": "get"
  },
  "response": {
    "body": [{ "id": "1" }, { "id": "2" }]
  }
}
```

```json
{
  "request": {
    "path": "/cdn/images/fennec.jpg",
    "method": "get"
  },
  "response": {
    "filepath": "/absolute/path/tofennec.jpg",
    "options": {
      "delay": 1000
    }
  }
}
```

```json
{
  "request": {
    "path": "/heros",
    "method": "POST",
    "body": {
      "name": "po",
      "type": "panda"
    },
    "options": {
      "body": {
        "strict": true
      }
    }
  },
  "response": {
    "body": {
      "id": "1",
      "name": "po",
      "type": "panda"
    }
  }
}
```

```json
{
  "request": {
    "path": "*",
    "method": "OPTIONS"
  },
  "response": {
    "headers": {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*"
    },
    "body": ""
  }
}
```

**Responses**

- Status 200 - OK

```json
{
  "id": "{string}"
}
```

Example:

```json
{
  "id": "38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508"
}
```

- Status 400 - BAD REQUEST

The configuration is not valid

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
      "path": "{string} - Http path to match requests, use wildcard '*' to match all",
      "method": "{string} - Http method to match requests, case insensitive, use wildcard '*' to match all",
      "headers": "{object|array} [default={}] - Headers to match requests",
      "query": "{object|array} [default={}] - Query to match requests",
      "cookies": "{object|array} [default={}] - Cookies to match requests",
      "body": "{object} [default=``] - Body to match requests",
      "options": {
        "headers": {
          "strict": "{boolean} [default=false] - Strictly match headers"
        },
        "cookies": {
          "strict": "{boolean} [default=false] - Strictly match cookies"
        },
        "query": {
          "strict": "{boolean} [default=false] - Strictly match query"
        },
        "body": {
          "strict": "{boolean} [default=false] - Strictly match body"
        }
      }
    },
    "response": {
      "status": "{number} [default=200] - Response status code",
      "headers": "{object|array} [default={}] - Response headers",
      "cookies": "{object|array} [default={}] - Response cookies",
      "body": "{string|object|array} [default=``] - Body response",
      "filepath": "{string} [default=``] - Filepath to serve with auto mime-types",
      "options": {
        "delay": "{number} [default=0] - Delay the response with a number of milliseconds",
        "lifetime": "{number} [default=1] - Number of times the fixture can be consumed before getting removed"
      }
    },
    "options": {}
  }
]
```

Examples:

```json
[
  {
    "request": {
      "path": "/pandas",
      "method": "get"
    },
    "response": {
      "body": [{ "id": "1" }, { "id": "2" }]
    }
  },
  {
    "request": {
      "path": "/cdn/images/fennec.jpg",
      "method": "get"
    },
    "response": {
      "filepath": "/absolute/path/tofennec.jpg"
    }
  }
]
```

**Responses**

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
    "id": "38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508"
  },
  {
    "id": "086c67ef89fd832deeae33b209e6e8ecc6b32003"
  }
]
```

- Status 400 - BAD REQUEST

The fixture is not valid

- Status 409 - CONFLICT

Another fixture with the same request is already registered

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
    DELETE /___fixtures/38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508
```

**Responses**

- Status 204 - NO CONTENT

<br/>

#### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_fixtures - **Delete all fixtures**

**Responses**

- Status 204 - NO CONTENT
