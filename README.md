# D3 Tree UI

## Overview

D3 Tree UI is the library to use tree structure that is made by [D3.js](https://d3js.org/).

<img src="https://github.com/masaki-ohsumi/d3-tree-ui/blob/develop/.doc/d3-tree-ui-image.png" alt="D3 Tree UI Image">

## DEMO

[D3 Tree UI - DEMO](https://d3-tree-ui.web.app/)

## Install

```
npm install d3-tree-ui
```

You can also download and use it.

```
<script src="public/d3-tree-ui.js"></script>
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

2. Create instance in script.

```js:sample.js
import { D3TreeUI } from "d3-tree-ui";

new D3TreeUI({
  selector: ".tree-wrap",
  json: "./data/sample-data.json",
  addToBottom: ".js-tree-addnode-bottom",
  addToRight: ".js-tree-addnode-right",
  nodeWidth: 200,
  nodeHeight: 32,
  nodeMargin: 8,
});
```

## Option

| param       | type    | description                                      |
| ----------- | ------- | ------------------------------------------------ |
| selector    | String  | className or Id of element to construct tree     |
| json        | String  | json file path to make tree                      |
| addToBottom | String  | className or Id of element to add node to bottom |
| addToRight  | String  | className or Id of element to add node to right  |
| nodeWidth   | Number  | width of each nodes                              |
| nodeHeight  | Number  | height of each nodes                             |
| addable     | Boolean | whether it can add node                          |
| editable    | Boolean | whether it can edit node name                    |
| draggable   | Boolean | whether it can drag node                         |
