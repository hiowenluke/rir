
// forks from:
// https://github.com/troygoode/node-require-directory

'use strict';

var fs = require('fs');
var join = require('path').join;
var resolve = require('path').resolve;
var dirname = require('path').dirname;

var defaultOptions = {
	extensions: ['js', 'json', 'coffee'],
	recurse: true,

	rename: function (name) {
		return name;
	},

	visit: function (obj) {
		return obj;
	}
};

var check = {
	inArray: function(path, filename, arr, True) {
		var False = !True;

		if (arr instanceof RegExp) {
			if (arr.test(path) === False) return false;
		}

		if (arr instanceof Array) {
			if ((arr.indexOf(filename) === -1 && arr.indexOf(filename.split('.')[0]) === -1) === True) return false;
		}

		if (typeof arr === 'function') {
			if (arr(path, filename) === False) return false;
		}

		return true;
	},

	inclusion: function(path, filename, options) {
		if (options.include) {
			return this.inArray(path, filename, options.include, true);
		}

		if (options.exclude) {
			return this.inArray(path, filename, options.exclude, false);
		}

		return true;
	},

	fileInclusion: function(path, filename, options) {
		if (options.extensions) {
			var reg = new RegExp('\\.(' + options.extensions.join('|') + ')$', 'i');
			if (!reg.test(filename)) return false;
		}

		return this.inclusion(path, filename, options);
	},

	dirInclusion: function(path, filename, options) {
		return this.inclusion(path, filename, options);
	}
};

var requireDirectory = function(m, path, options) {
	var retval = {};

	// path is optional
	if (path && !options && typeof path !== 'string') {
		options = path;
		path = null;
	}

	// default options
	options = options || {};
	for (var prop in defaultOptions) {
		if (typeof options[prop] === 'undefined') {
			options[prop] = defaultOptions[prop];
		}
	}

	if (typeof options.exclude === 'string') {
		options.exclude = [options.exclude];
	}

	if (typeof options.include === 'string') {
		options.include = [options.include];
	}

	var vfn = options.virtualIndexFn;

	// if no path was passed in, assume the equivelant of __dirname from caller
	// otherwise, resolve path relative to the equivalent of __dirname
	path = !path ? dirname(m.filename) : resolve(dirname(m.filename), path);

	// get the path of each file in specified directory, append to current tree node, recurse
	fs.readdirSync(path).forEach(function (filename) {
		var joined = join(path, filename),
			files,
			key,
			obj;

		// this node is a directory
		if (fs.statSync(joined).isDirectory()) {
			if (!check.dirInclusion(joined, filename, options)) return;

			if (options.recurse) {

				// load valid Node.js directory if the index.js is not in options.exclude
				if (fs.existsSync(joined + '/index.js') && check.fileInclusion(joined, 'index.js', options)) {
					files = require(joined);
					files.isIndexJs = true;
				}
				else {
					// load all sub-directories in this directory
					files = requireDirectory(m, joined, options);

					// if a virtual index function is specified (e.g., in kdo), apply it
					if (vfn) {

						// pass joined and filename to vfn
						files = vfn(files, joined, filename);
						files.isIndexJs = true;
					}
				}
			}
			else {
				// load valid Node.js directory
				if (fs.existsSync(joined + '/index.js')) {
					files = require(joined);
					files.isIndexJs = true;
				}
			}
			// exclude empty directories
			if (files && (typeof files === 'function' || Object.keys(files).length)) {
				retval[options.rename(filename, joined, filename)] = files;
			}
		}
		else if (joined !== m.filename && check.fileInclusion(joined, filename, options)) {
			// hash node key shouldn't include file extension
			key = filename.substring(0, filename.lastIndexOf('.'));
			obj = require(joined);

			// for kdo
			obj.filename = filename.replace(/\.[a-zA-Z]+$/, '');

			retval[options.rename(key, joined, filename)] = options.visit(obj, joined, filename) || obj;
		}
	});

	return retval;
};

module.exports = requireDirectory;
module.exports.defaults = defaultOptions;
