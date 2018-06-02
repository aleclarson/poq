// Generated by CoffeeScript 2.3.0
var AcornMixin, MagicSlice, Walker, acorn, createMixin, getArray, greedyRange, indent, isLiteral, noop, parseDepth, process, stack, stripIndent;

({greedyRange, indent, noop, parseDepth, stripIndent} = require('./utils'));

MagicSlice = require('./slice');

Walker = require('./walker');

acorn = require('acorn');

stack = []; // for nested processing

AcornMixin = exports;

AcornMixin.init = function(acorn, output, walker) {
  var key, mixin, prev, pt;
  pt = acorn.Node.prototype;
  mixin = createMixin(output, walker);
  if (pt.nebu) {
    prev = {};
    for (key in mixin) {
      prev[key] = pt[key];
      pt[key] = mixin[key];
    }
    stack.push(prev);
  } else {
    Object.assign(pt, mixin);
  }
  return mixin;
};

AcornMixin.remove = function(acorn, mixin) {
  var key, prev, pt;
  pt = acorn.Node.prototype;
  if (prev = stack.pop()) {
    for (key in prev) {
      pt[key] = prev[key];
    }
    return;
  }
  for (key in mixin) {
    delete pt[key];
  }
};

isLiteral = function(type) {
  if (this.type === 'Literal') {
    return !type || typeof this.value === type;
  } else {
    return false;
  }
};

// Process any node with other plugins.
process = function(node, source, state, plugins) {
  var mixin, slice, walker;
  if (!node.stale) {
    slice = new MagicSlice(source, node.start, node.end);
    walker = new Walker(state, plugins);
    mixin = AcornMixin.apply(slice, walker);
    walker.walk(this);
    AcornMixin.remove(mixin);
  }
};

// Context-aware mixin for acorn Node objects
createMixin = function(output, walker) {
  var input, removeNodes, tab;
  tab = output.indentStr || '  ';
  input = output.original;
  // Remove a range of nodes.
  removeNodes = function(nodes, parent, ref, i, n) {
    var node;
    n = Math.min(i + n, nodes.length);
    while (true) {
      node = nodes[i];
      if (!node.stale) {
        node.parent = parent;
        node.ref = ref;
        output.remove(...greedyRange(input, node, i));
        walker.drop(node);
      }
      if (++i === n) {
        return;
      }
    }
  };
  return {
    nebu: require('.'),
    isLiteral: isLiteral,
    toString: function() {
      return stripIndent(input.slice(this.start, this.end), tab);
    },
    process: function(state, plugins) {
      if (arguments.length === 1) {
        plugins = state;
        state = null;
      }
      if (!Array.isArray(plugins)) {
        throw TypeError('`plugins` must be an array');
      }
      process(this, output, state, plugins);
      return this;
    },
    walk: function(prop, iter = noop) {
      var val;
      if (!(val = this[prop])) {
        return this;
      }
      if (Array.isArray(val)) {
        val.forEach((val, i) => {
          val.parent = this;
          val.ref = prop;
          return iter(val, i);
        });
      } else if (typeof val.type === 'string') {
        val.parent = this;
        val.ref = prop;
        iter(val);
      }
      return this;
    },
    yield: function(resume) {
      if (this.yields) {
        this.yields.push(resume);
      } else {
        this.yields = [resume];
      }
      return this;
    },
    set: function(prop, code) {
      var val;
      if (!(val = this[prop])) {
        return this;
      }
      if (Array.isArray(val)) {
        return this.splice(prop, 0, 2e308, code);
      }
      if (val.type === 'BlockStatement') {
        val.parent = this;
        val.ref = prop;
        return val.splice('body', 0, 2e308, code);
      }
      if (typeof val.type === 'string') {
        output.overwrite(val.start, val.end, code);
        walker.drop(val);
      }
      return this;
    },
    push: function(prop, code) {
      var arr, node;
      arr = getArray(this, prop);
      if (node = arr[arr.length - 1]) {
        node.after(code);
        return this;
      }
      node = arr === this[prop] && this || this[prop];
      output.appendRight(node.start + 1, code);
      return this;
    },
    unshift: function(prop, code) {
      var arr, node;
      arr = getArray(this, prop);
      if (node = arr[0]) {
        node.before(code);
        return this;
      }
      node = arr === this[prop] && this || this[prop];
      output.appendLeft(node.start + 1, code);
      return this;
    },
    splice: function(prop, i, n, code) {
      var arr, len, val;
      arr = getArray(this, prop);
      len = arr.length;
      if (i < 0) {
        i = i % (len + 1) + len;
      } else if (i >= len) {
        if (!code) {
          return this;
        }
        return this.push(prop, code);
      }
      if (n > 0) {
        if (arr !== (val = this[prop])) {
          val.parent = this;
          val.ref = prop;
          removeNodes(val.body, val, 'body', i, n);
        } else {
          removeNodes(val, this, prop, i, n);
        }
      }
      if (code) {
        if (i !== 0) {
          output.appendLeft(arr[i - 1].end, code);
          return this;
        }
        if (this.type === 'BlockStatement') {
          if (this.depth == null) {
            this.depth = parseDepth(this, tab, input);
          }
          code = indent('\n' + code, tab, this.depth);
        }
        return this.unshift(prop, code);
      }
      return this;
    },
    before: function(code) {
      if (this.depth == null) {
        this.depth = parseDepth(this, tab, input);
      }
      output.prependLeft(this.start, indent(code, tab, this.depth));
      return this;
    },
    after: function(code) {
      if (this.depth == null) {
        this.depth = parseDepth(this, tab, input);
      }
      output.appendRight(this.end, indent(code, tab, this.depth));
      return this;
    },
    indent: function(depth = 1) {
      var end, i, prefix, start;
      [start, end] = greedyRange(input, this);
      prefix = tab.repeat(depth);
      i = start - 1;
      while (true) {
        i = input.indexOf('\n', i + 1);
        if (i === -1 || i >= end) {
          break;
        }
        output.appendLeft(i + 1, prefix);
      }
      return this;
    },
    dedent: function(depth = 1) {
      var end, i, start, width;
      if (this.depth == null) {
        this.depth = parseDepth(this, tab, input);
      }
      if (depth > this.depth) {
        depth = this.depth;
      }
      if (depth === 0) {
        return this;
      }
      [start, end] = greedyRange(input, this);
      width = tab.length * depth;
      i = start - 1;
      while (true) {
        i = input.indexOf('\n', i + 1);
        if (i === -1 || i >= end) {
          break;
        }
        output.remove(i, i + width);
      }
      return this;
    },
    replace: function(code) {
      output.overwrite(this.start, this.end, code);
      walker.drop(this);
      return this;
    },
    remove: function(prop) {
      var val;
      if (this.stale) {
        return this;
      }
      if (!prop) {
        output.remove(...greedyRange(input, this));
        walker.drop(this);
        return this;
      }
      if (!(val = this[prop])) {
        return this;
      }
      if (Array.isArray(val)) {
        removeNodes(val, this, prop, 0, 2e308);
      } else if (val.type === 'BlockStatement') {
        val.parent = this;
        val.ref = prop;
        removeNodes(val.body, val, 'body', 0, 2e308);
      } else if (typeof val.type === 'string') {
        output.remove(val.start, val.end);
        walker.drop(val);
      }
      return this;
    }
  };
};

getArray = function(node, prop) {
  var val;
  if (val = node[prop]) {
    if (Array.isArray(val)) {
      return val;
    }
    if (val.type === 'BlockStatement') {
      return val.body;
    }
  }
  throw Error(`'${prop}' is not an array or BlockStatement`);
};
