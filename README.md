# dynamock

[![npm version](https://img.shields.io/npm/v/dynamock)](https://www.npmjs.com/package/dynamock)
![node](https://img.shields.io/node/v/dynamock)
[![Build Status](https://github.com/devside/dynamock/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/DevSide/dynamock/actions/workflows/ci.yml?query=branch%3Amaster)
[![Coverage Status](https://coveralls.io/repos/github/DevSide/dynamock/badge.svg?branch=master)](https://coveralls.io/github/DevSide/dynamock?branch=master)

`dynamock` is a dynamic mock/fixture HTTP server designed for functional testing.<br>

## Installation

```bash
yarn add dynamock -D
# or NPM
npm install dynamock --save-dev
```

## Usage

### ⚠️ Security

Be aware of running your dynamock server in a CLOSED network, there is no authentication required to configure it.<br>
It is highly recommended using dynamock for dev/testing purpose ONLY.

### Run the server (NodeJS required)

```bash
# dynamock PORT [HOST]
dynamock 3001
```

### Inject fixtures

```js
fetch('http://localhost:3001/___fixtures', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    request: {
      method: 'GET',
      path: '/products/1'
    },
    response: {
      body: {
        id: 1
      }
    }
  })
})
```

### Consume fixtures

```js
fetch('http://localhost:3001/products/1', { method: 'GET' })
  .then(response => response.json())
  .then(response => assert.equal(response, { id: 1 }))
```

Dynamock is designed to remove the fixture once consumed, see options.lifetime to adapt this behavior.

```js
fetch('http://localhost:3001/products/1', { method: 'GET' }).then(response => assert.equal(response.status, 404))
```

## Property response matching

By default, dynamock uses partial matching for `headers`, `query` and `cookies`.

## Configuration api

Using the configuration is optional. However, it gives the ability of reusing redundant data across requests and simplifying fixtures setup.

### <img src="https://img.shields.io/badge/GET-61affe.svg" alt="GET" /> /\_\_\_config - **Retrieve configuration**

**Responses**

- Status 200 - OK

```json
{
  "cors": "{null|'*'} - '*' allows all requests via cors headers, this creates a global route OPTIONS",
  "headers": "{object} - Dictionary of headers (object) by name (string)",
  "query": "{object} - Dictionary of query (object) by name (string)",
  "cookies": "{object} - Dictionary of cookies (object) by name (string)"
}
```

Example:

```json
{
  "cors": null,
  "headers": {},
  "query": {},
  "cookies": {}
}
```

### <img src="https://img.shields.io/badge/PUT-fca130.svg" alt="PUT" /> /\_\_\_config - **Update configuration**

**Request**

- Body

```json
{
  "cors": "{null|'*'} [default=null] - '*' allows all requests via cors headers, this creates a global route OPTIONS",
  "headers": "{object} [default={}] - Dictionary of headers (object) by name (string)",
  "query": "{object} [default={}] - Dictionary of query (object) by name (string)",
  "cookies": "{object} [default={}] - Dictionary of cookies (object) by name (string)"
}
```

Example:

```json
{
  "cors": "*",
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
  "cors": "{null|'*'}",
  "headers": "{object}",
  "query": "{object}",
  "cookies": "{object}"
}
```

Example:

```json
{
  "cors": null,
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

### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_config - **Reset configuration**

**Responses**

- Status 204 - NO CONTENT

<br>

## Fixtures api

A fixture is composed of:

- request data to match the incoming requests
- response data to define the result(s) of the requests

<br/>

### <img src="https://img.shields.io/badge/POST-49cc90.svg" alt="POST" /> /\_\_\_fixtures - **Add fixture**

**Request**

- Body

```json
{
  "request": {
    "method": "{string} - Http method to match requests, case insensitive, use wildcard '*' to match all",
    "path": "{string} - Http path to match requests, use wildcard '*' to match all",
    "headers": "{object|array} [default={}] - Headers to match requests",
    "query": "{object|array} [default={}] - Query to match requests",
    "cookies": "{object|array} [default={}] - Cookies to match requests",
    "body": "{object} [default=``] - Body to match requests",
    "options": {
      "path": {
        "allowRegex": "{boolean} [default=false] - Allow matching RegExp",
        "disableEncodeURI": "{boolean} [default=false] - Disable encode URI, always on when allowRegex is true"
      },
      "method": {
        "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
      },
      "headers": {
        "strict": "{boolean} [default=false] - Strictly match headers",
        "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
      },
      "cookies": {
        "strict": "{boolean} [default=false] - Strictly match cookies",
        "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
      },
      "query": {
        "strict": "{boolean} [default=false] - Strictly match query",
        "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
      },
      "body": {
        "strict": "{boolean} [default=false] - Strictly match body",
        "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
      }
    }
  },
  "response": {
    "status": "{number} [default=200] - Response status code",
    "headers": "{object|array} [default={}] - Response headers",
    "cookies": "{object|array} [default={}] - Response cookies",
    "body": "{string|object|array} [default=``] - Body to response",
    "filepath": "{string} [default=``] - Absolute filepath to serve with auto mime-types",
    "options": {
      "delay": "{number} [default=0] - Delay the response with a number of milliseconds",
      "lifetime": "{number} [default=1] - Number of times the fixture can be consumed before getting removed, use 0 for unlimited consumption"
    }
  },
  "responses": "{array} [default=[]] - Array of responses"
}
```

Examples:

```json
{
  "request": {
    "method": "GET",
    "path": "/pandas"
  },
  "response": {
    "body": [{ "id": "1" }, { "id": "2" }]
  }
}
```

```json
{
  "request": {
    "method": "GET",
    "path": "/cdn/images/fennec.jpg"
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
    "method": "POST",
    "path": "/heros",
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
    "method": "OPTIONS",
    "path": "*"
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

```json
{
  "request": {
    "method": "get",
    "path": "/"
  },
  "responses": [
    {
      "body": "first return"
    },
    {
      "body": "second return"
    }
  ]
}
```

```json
{
  "request": {
    "method": "GET",
    "path": "/",
    "headers": {
      "user-agent": "/firefox/70$/i"
    },
    "options": {
      "headers": {
        "allowRegex": true
      }
    }
  },
  "response": {
    "body": "Only for Firefox 70 users !"
  }
}
```

```json
{
  "request": {
    "method": "GET",
    "path": "/%20a",
    "options": {
      "path": {
        "disableEncodeURI": true
      }
    }
  },
  "response": {
    "body": "This will match '/ a' or '/%20a' calls"
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

### <img src="https://img.shields.io/badge/POST-49cc90.svg" alt="POST" /> /\_\_\_fixtures/bulk - **Bulk add fixtures**

It is meant to setup multiple fixtures at once.

**Request**

- Body

```json
[
  {
    "request": {
      "method": "{string} - Http method to match requests, case insensitive, use wildcard '*' to match all",
      "path": "{string} - Http path to match requests, use wildcard '*' to match all",
      "headers": "{object|array} [default={}] - Headers to match requests",
      "query": "{object|array} [default={}] - Query to match requests",
      "cookies": "{object|array} [default={}] - Cookies to match requests",
      "body": "{object} [default=``] - Body to match requests",
      "options": {
        "path": {
          "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
        },
        "method": {
          "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
        },
        "headers": {
          "strict": "{boolean} [default=false] - Strictly match headers",
          "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
        },
        "cookies": {
          "strict": "{boolean} [default=false] - Strictly match cookies",
          "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
        },
        "query": {
          "strict": "{boolean} [default=false] - Strictly match query",
          "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
        },
        "body": {
          "strict": "{boolean} [default=false] - Strictly match body",
          "allowRegex": "{boolean} [default=false] - Allow matching RegExp"
        }
      }
    },
    "response": {
      "status": "{number} [default=200] - Response status code",
      "headers": "{object|array} [default={}] - Response headers",
      "cookies": "{object|array} [default={}] - Response cookies",
      "body": "{string|object|array} [default=``] - Body response",
      "filepath": "{string} [default=``] - Absolute filepath to serve with auto mime-types",
      "options": {
        "delay": "{number} [default=0] - Delay the response with a number of milliseconds",
        "lifetime": "{number} [default=1] - Number of times the fixture can be consumed before getting removed, use 0 for unlimited consumption"
      }
    },
    "responses": "{array} [default=[]] - Array of responses"
  }
]
```

Examples:

```json
[
  {
    "request": {
      "method": "GET",
      "path": "/pandas"
    },
    "response": {
      "body": [{ "id": "1" }, { "id": "2" }]
    }
  },
  {
    "request": {
      "method": "GET",
      "path": "/cdn/images/fennec.jpg"
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

### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_fixtures/:id - **Delete a fixture**

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

### <img src="https://img.shields.io/badge/DELETE-f93e3e.svg" alt="DELETE" /> /\_\_\_fixtures - **Delete all fixtures**

**Responses**

- Status 204 - NO CONTENT

## Next features

- Handle other web protocols like https or websocket
- Security tokens for public environments
