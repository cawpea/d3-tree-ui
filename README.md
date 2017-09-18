# D3 Tree UI

## Overview

D3 Tree UI is the library to use tree structure that is made by [D3.js](https://d3js.org/).

[DEMO](http://demo-d3-tree-ui.hellopeople.jp/)

## Install

```
npm install d3-tree-ui
```

## Usage

1. Prepare json data like following structure.

```json:sample-data.json
{
  "id": 0,
  "name": "Object",
  "children": [
      {
        "id": 1,
        "parent": 0,
        "name": "navigator",
        "children": []
      },
      {
        "id": 2,
        "parent": 0,
        "name": "window",
        "children": []
      }
  ]
}
```

2. 