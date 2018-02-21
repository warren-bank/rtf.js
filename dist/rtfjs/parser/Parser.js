/*

The MIT License (MIT)

Copyright (c) 2015 Thomas Bluemel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
import { SymbolTable } from '../Symboltable';
import { RenderPap } from './RenderPap';
import cptable from 'codepage';
import { Helper, RTFJSError } from '../Helper';
import { RenderChp } from './RenderChp';
var Parser = /** @class */ (function () {
    function Parser(document) {
        this.inst = document;
    }
    Parser.prototype.parse = function (blob, renderer) {
        var inst = this.inst;
        var parseKeyword, processKeyword, appendText, parseLoop;
        var Chp = function (parent) {
            if (parent != null) {
                this.bold = parent.bold;
                this.underline = parent.underline;
                this.italic = parent.italic;
                this.strikethrough = parent.strikethrough;
                this.dblstrikethrough = parent.dblstrikethrough;
                this.colorindex = parent.colorindex;
                this.fontsize = parent.fontsize;
                this.fontfamily = parent.fontfamily;
            }
            else {
                this.bold = false;
                this.underline = Helper.UNDERLINE.NONE;
                this.italic = false;
                this.strikethrough = false;
                this.dblstrikethrough = false;
                this.colorindex = 0;
                this.fontsize = 24;
            }
        };
        var Pap = function (parent) {
            if (parent != null) {
                this.indent = {
                    left: parent.indent.left,
                    right: parent.indent.right,
                    firstline: parent.indent.firstline
                };
                this.justification = parent.justification;
                this.spacebefore = parent.spacebefore;
                this.spaceafter = parent.spaceafter;
                this.charactertype = parent.charactertype;
            }
            else {
                this.indent = {
                    left: 0,
                    right: 0,
                    firstline: 0
                };
                this.justification = Helper.JUSTIFICATION.LEFT;
                this.spacebefore = 0;
                this.spaceafter = 0;
            }
        };
        var Sep = function (parent) {
            if (parent != null) {
                this.columns = parent.columns;
                this.breaktype = parent.breaktype;
                this.pagenumber = {
                    x: parent.pagenumber.x,
                    y: parent.pagenumber.y
                };
                this.pagenumberformat = parent.pagenumberformat;
            }
            else {
                this.columns = 0;
                this.breaktype = Helper.BREAKTYPE.NONE;
                this.pagenumber = {
                    x: 0,
                    y: 0,
                };
                this.pagenumberformat = Helper.PAGENUMBER.DECIMAL;
            }
        };
        var Dop = function (parent) {
            if (parent != null) {
                this.width = parent.width;
                this.height = parent.height;
                this.margin = {
                    left: parent.margin.left,
                    top: parent.margin.top,
                    right: parent.margin.right,
                    bottom: parent.margin.bottom
                };
                this.pagenumberstart = parent.pagenumberstart;
                this.facingpages = parent.facingpages;
                this.landscape = parent.landscape;
            }
            else {
                this.width = 0;
                this.height = 0;
                this.margin = {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0
                };
                this.pagenumberstart = 0;
                this.facingpages = false;
                this.landscape = false;
            }
        };
        var State = function (parent) {
            this.parent = parent;
            this.first = true;
            this.skipchars = 0;
            this.bindata = 0;
            if (parent != null) {
                this.chp = new Chp(parent.chp);
                this.pap = new Pap(parent.pap);
                this.sep = new Sep(parent.sep);
                this.dop = new Dop(parent.dop);
                this.destination = parent.destination;
                this.skipunknowndestination = parent.skipunknowndestination;
                this.skipdestination = parent.skipdestination;
                this.ucn = parent.ucn;
            }
            else {
                this.chp = new Chp(null);
                this.pap = new Pap(null);
                this.sep = new Sep(null);
                this.dop = new Dop(null);
                this.destination = null;
                this.skipunknowndestination = false;
                this.skipdestination = false;
                this.ucn = 1;
            }
        };
        var parser = {
            data: new Uint8Array(blob),
            pos: 0,
            line: 1,
            column: 0,
            state: null,
            version: null,
            text: "",
            codepage: 1252,
            eof: function () {
                return this.pos >= this.data.length;
            },
            readChar: function () {
                if (this.pos < this.data.length) {
                    parser.column++;
                    return String.fromCharCode(this.data[this.pos++]);
                }
                throw new RTFJSError("Unexpected end of file");
            },
            unreadChar: function () {
                if (this.pos > 0) {
                    parser.column--;
                    this.pos--;
                }
                else {
                    throw new RTFJSError("Already at beginning of file");
                }
            },
            readBlob: function (cnt) {
                if (this.pos + cnt > this.data.length)
                    throw new RTFJSError("Cannot read binary data: too long");
                var buf = new ArrayBuffer(cnt);
                var view = new Uint8Array(buf);
                for (var i = 0; i < cnt; i++)
                    view[i] = this.data[this.pos + i];
                return buf;
            }
        };
        var findParentDestination = function (dest) {
            var state = parser.state;
            while (state != null) {
                if (state.destination == null)
                    break;
                if (state.destination._name == dest)
                    return state.destination;
                state = state.parent;
            }
            Helper.log("findParentDestination() did not find destination " + dest);
        };
        var DestinationBase = function (name) {
            this._name = name;
        };
        var DestinationTextBase = function (name) {
            this._name = name;
            this.text = "";
        };
        DestinationTextBase.prototype.appendText = function (text) {
            this.text += text;
        };
        var DestinationFormattedTextBase = function (name) {
            this._name = name;
            this._records = [];
        };
        DestinationFormattedTextBase.prototype.appendText = function (text) {
            this._records.push(function (rtf) {
                rtf.appendText(text);
            });
        };
        DestinationFormattedTextBase.prototype.handleKeyword = function (keyword, param) {
            this._records.push(function (rtf) {
                return rtf.handleKeyword(keyword, param);
            });
        };
        DestinationFormattedTextBase.prototype.apply = function () {
            var rtf = findParentDestination("rtf");
            if (rtf == null)
                throw new RTFJSError("Destination " + this._name + " is not child of rtf destination");
            var len = this._records.length;
            var doRender = true;
            if (this.renderBegin != null)
                doRender = this.renderBegin(rtf, len);
            if (doRender) {
                for (var i = 0; i < len; i++) {
                    this._records[i](rtf);
                }
                ;
                if (this.renderEnd != null)
                    this.renderEnd(rtf, len);
            }
            delete this._records;
        };
        var rtfDestination = function () {
            var cls = function (name, param) {
                if (parser.version != null)
                    throw new RTFJSError("Unexpected rtf destination");
                DestinationBase.call(this, name);
                // This parameter should be one, but older versions of the spec allow for omission of the version number
                if (param && param != 1)
                    throw new RTFJSError("Unsupported rtf version");
                parser.version = 1;
                this._metadata = {};
            };
            cls.prototype = Object.create(DestinationBase.prototype);
            cls.prototype.addIns = function (func) {
                inst.addIns(func);
            };
            cls.prototype.appendText = function (text) {
                Helper.log("[rtf] output: " + text);
                inst.addIns(text);
            };
            cls.prototype.sub = function () {
                Helper.log("[rtf].sub()");
            };
            var _addInsHandler = function (func) {
                return function (param) {
                    inst.addIns(func);
                };
            };
            var _addFormatIns = function (ptype, props) {
                switch (ptype) {
                    case "chp":
                        var rchp = new RenderChp(new Chp(props));
                        inst.addIns(function () {
                            this.setChp(rchp);
                        });
                        break;
                    case "pap":
                        var rpap = new RenderPap(new Pap(props));
                        inst.addIns(function () {
                            this.setPap(rpap);
                        });
                        break;
                }
            };
            var _genericFormatSetNoParam = function (ptype, prop, val) {
                return function (param) {
                    var props = parser.state[ptype];
                    props[prop] = val;
                    Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
                    _addFormatIns(ptype, props);
                };
            };
            var _genericFormatOnOff = function (ptype, prop, onval, offval) {
                return function (param) {
                    var props = parser.state[ptype];
                    props[prop] = (param == null || param != 0) ? (onval != null ? onval : true) : (offval != null ? offval : false);
                    Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
                    _addFormatIns(ptype, props);
                };
            };
            var _genericFormatSetVal = function (ptype, prop, defaultval) {
                return function (param) {
                    var props = parser.state[ptype];
                    props[prop] = (param == null) ? defaultval : param;
                    Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
                    _addFormatIns(ptype, props);
                };
            };
            var _genericFormatSetValRequired = function (ptype, prop) {
                return function (param) {
                    if (param == null)
                        throw new RTFJSError("Keyword without required param");
                    var props = parser.state[ptype];
                    props[prop] = param;
                    Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
                    _addFormatIns(ptype, props);
                };
            };
            var _genericFormatSetMemberVal = function (ptype, prop, member, defaultval) {
                return function (param) {
                    var props = parser.state[ptype];
                    var members = props[prop];
                    members[member] = (param == null) ? defaultval : param;
                    Helper.log("[rtf] state." + ptype + "." + prop + "." + member + " = " + members[member].toString());
                    _addFormatIns(ptype, props);
                };
            };
            var _charFormatHandlers = {
                ansicpg: function (param) {
                    //if the value is 0, use the default charset as 0 is not valid
                    if (param > 0) {
                        Helper.log("[rtf] using charset: " + param);
                        parser.codepage = param;
                    }
                },
                sectd: function (param) {
                    Helper.log("[rtf] reset to section defaults");
                    parser.state.sep = new Sep(null);
                },
                plain: function (param) {
                    Helper.log("[rtf] reset to character defaults");
                    parser.state.chp = new Chp(null);
                },
                pard: function (param) {
                    Helper.log("[rtf] reset to paragraph defaults");
                    parser.state.pap = new Pap(null);
                },
                b: _genericFormatOnOff("chp", "bold"),
                i: _genericFormatOnOff("chp", "italic"),
                cf: _genericFormatSetValRequired("chp", "colorindex"),
                fs: _genericFormatSetValRequired("chp", "fontsize"),
                f: _genericFormatSetValRequired("chp", "fontfamily"),
                loch: _genericFormatSetNoParam("pap", "charactertype", Helper.CHARACTER_TYPE.LOWANSI),
                hich: _genericFormatSetNoParam("pap", "charactertype", Helper.CHARACTER_TYPE.HIGHANSI),
                dbch: _genericFormatSetNoParam("pap", "charactertype", Helper.CHARACTER_TYPE.DOUBLE),
                strike: _genericFormatOnOff("chp", "strikethrough"),
                striked: _genericFormatOnOff("chp", "dblstrikethrough"),
                ul: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.CONTINUOUS, Helper.UNDERLINE.NONE),
                uld: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DOTTED, Helper.UNDERLINE.NONE),
                uldash: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DASHED, Helper.UNDERLINE.NONE),
                uldashd: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DASHDOTTED, Helper.UNDERLINE.NONE),
                uldashdd: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DASHDOTDOTTED, Helper.UNDERLINE.NONE),
                uldb: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DOUBLE, Helper.UNDERLINE.NONE),
                ulhwave: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.HEAVYWAVE, Helper.UNDERLINE.NONE),
                ulldash: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.LONGDASHED, Helper.UNDERLINE.NONE),
                ulnone: _genericFormatSetNoParam("chp", "underline", Helper.UNDERLINE.NONE),
                ulth: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICK, Helper.UNDERLINE.NONE),
                ulthd: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDOTTED, Helper.UNDERLINE.NONE),
                ulthdash: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDASHED, Helper.UNDERLINE.NONE),
                ulthdashd: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDASHDOTTED, Helper.UNDERLINE.NONE),
                ulthdashdd: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDASHDOTDOTTED, Helper.UNDERLINE.NONE),
                ululdbwave: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DOUBLEWAVE, Helper.UNDERLINE.NONE),
                ulw: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.WORD, Helper.UNDERLINE.NONE),
                ulwave: _genericFormatOnOff("chp", "underline", Helper.UNDERLINE.WAVE, Helper.UNDERLINE.NONE),
                li: _genericFormatSetMemberVal("pap", "indent", "left", 0),
                ri: _genericFormatSetMemberVal("pap", "indent", "right", 0),
                fi: _genericFormatSetMemberVal("pap", "indent", "firstline", 0),
                sa: _genericFormatSetValRequired("pap", "spaceafter"),
                sb: _genericFormatSetValRequired("pap", "spacebefore"),
                cols: _genericFormatSetVal("sep", "columns", 0),
                sbknone: _genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.NONE),
                sbkcol: _genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.COL),
                sbkeven: _genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.EVEN),
                sbkodd: _genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.ODD),
                sbkpage: _genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.PAGE),
                pgnx: _genericFormatSetMemberVal("sep", "pagenumber", "x", 0),
                pgny: _genericFormatSetMemberVal("sep", "pagenumber", "y", 0),
                pgndec: _genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.DECIMAL),
                pgnucrm: _genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.UROM),
                pgnlcrm: _genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.LROM),
                pgnucltr: _genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.ULTR),
                pgnlcltr: _genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.LLTR),
                qc: _genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.CENTER),
                ql: _genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.LEFT),
                qr: _genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.RIGHT),
                qj: _genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.JUSTIFY),
                paperw: _genericFormatSetVal("dop", "width", 12240),
                paperh: _genericFormatSetVal("dop", "height", 15480),
                margl: _genericFormatSetMemberVal("dop", "margin", "left", 1800),
                margr: _genericFormatSetMemberVal("dop", "margin", "right", 1800),
                margt: _genericFormatSetMemberVal("dop", "margin", "top", 1440),
                margb: _genericFormatSetMemberVal("dop", "margin", "bottom", 1440),
                pgnstart: _genericFormatSetVal("dop", "pagenumberstart", 1),
                facingp: _genericFormatSetNoParam("dop", "facingpages", true),
                landscape: _genericFormatSetNoParam("dop", "landscape", true),
                par: _addInsHandler(function () {
                    this.startPar();
                }),
                line: _addInsHandler(function () {
                    this.lineBreak();
                }),
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                var handler = _charFormatHandlers[keyword];
                if (handler != null) {
                    handler(param);
                    return true;
                }
                //Helper.log("[rtf] unhandled keyword: " + keyword + " param: " + param);
                return false;
            };
            cls.prototype.apply = function () {
                Helper.log("[rtf] apply()");
                for (var prop in this._metadata)
                    inst._meta[prop] = this._metadata[prop];
                delete this._metadata;
            };
            cls.prototype.setMetadata = function (prop, val) {
                this._metadata[prop] = val;
            };
            return cls;
        };
        var genericPropertyDestination = function (parentdest, metaprop) {
            var cls = function (name) {
                DestinationTextBase.call(this, name);
            };
            cls.prototype = Object.create(DestinationTextBase.prototype);
            cls.prototype.apply = function () {
                var dest = findParentDestination(parentdest);
                if (dest == null)
                    throw new RTFJSError("Destination " + this._name + " must be within " + parentdest + " destination");
                if (dest.setMetadata == null)
                    throw new RTFJSError("Destination " + parentdest + " does not accept meta data");
                dest.setMetadata(metaprop, this.text);
            };
            return cls;
        };
        var infoDestination = function () {
            var cls = function (name) {
                DestinationBase.call(this, name);
                this._metadata = {};
            };
            cls.prototype.apply = function () {
                for (var prop in this._metadata)
                    inst._meta[prop] = this._metadata[prop];
                delete this._metadata;
            };
            cls.prototype.setMetadata = function (prop, val) {
                this._metadata[prop] = val;
            };
            return cls;
        };
        var metaPropertyDestination = function (metaprop) {
            var cls = function (name) {
                DestinationTextBase.call(this, name);
            };
            cls.prototype = Object.create(DestinationTextBase.prototype);
            cls.prototype.apply = function () {
                var info = findParentDestination("info");
                if (info == null)
                    throw new RTFJSError("Destination " + this._name + " must be within info destination");
                info.setMetadata(metaprop, this.text);
            };
            return cls;
        };
        var metaPropertyTimeDestination = function (metaprop) {
            var cls = function (name) {
                DestinationBase.call(this, name);
                this._yr = null;
                this._mo = null;
                this._dy = null;
                this._hr = null;
                this._min = null;
                this._sec = null;
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                switch (keyword) {
                    case "yr":
                        this._yr = param;
                        break;
                    case "mo":
                        this._mo = param;
                        break;
                    case "dy":
                        this._dy = param;
                        break;
                    case "hr":
                        this._hr = param;
                        break;
                    case "min":
                        this._min = param;
                        break;
                    case "sec":
                        this._sec = param;
                        break;
                    default:
                        return false;
                }
                if (param == null)
                    throw new RTFJSError("No param found for keyword " + keyword);
                return true;
            };
            cls.prototype.apply = function () {
                var info = findParentDestination("info");
                if (info == null)
                    throw new RTFJSError("Destination " + this._name + " must be within info destination");
                var date = new Date(this._yr != null ? this._yr : 1970, this._mo != null ? this._mo : 1, this._dy != null ? this._dy : 1, this._hr != null ? this._hr : 0, this._min != null ? this._min : 0, this._sec != null ? this._sec : 0, 0);
                info.setMetadata(metaprop, date);
            };
            return cls;
        };
        var fonttblDestinationSub = function () {
            var cls = function (fonttbl) {
                DestinationBase.call(this, "fonttbl:sub");
                this._fonttbl = fonttbl;
                this.index = null;
                this.fontname = null;
                this.altfontname = null;
                this.family = null;
                this.pitch = Helper.FONTPITCH.DEFAULT;
                this.bias = 0;
                this.charset = null;
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                switch (keyword) {
                    case "f":
                        this.index = param;
                        return true;
                    case "fnil":
                        return true;
                    case "froman":
                    case "fswiss":
                    case "fmodern":
                    case "fscript":
                    case "fdecor":
                    case "ftech":
                    case "fbidi":
                    case "flomajor":
                    case "fhimajor":
                    case "fdbmajor":
                    case "fbimajor":
                    case "flominor":
                    case "fhiminor":
                    case "fdbminor":
                    case "fbiminor":
                        this.family = keyword.slice(1);
                        return true;
                    case "fprq":
                        switch (param) {
                            case 0:
                                this.pitch = Helper.FONTPITCH.DEFAULT;
                                break;
                            case 1:
                                this.pitch = Helper.FONTPITCH.FIXED;
                                break;
                            case 2:
                                this.pitch = Helper.FONTPITCH.VARIABLE;
                                break;
                        }
                        return true;
                    case "fbias":
                        if (param != null)
                            this.bias = param;
                        return true;
                    case "fcharset":
                        if (param != null) {
                            this.charset = Helper._mapCharset(param);
                            if (this.charset == null)
                                Helper.log("Unknown font charset: " + param);
                        }
                        return true;
                    case "cpg":
                        if (param != null) {
                            this.charset = param;
                        }
                        return true;
                }
                return false;
            };
            cls.prototype.appendText = function (text) {
                if (this.fontname == null)
                    this.fontname = text;
                else
                    this.fontname += text;
            };
            cls.prototype.apply = function () {
                if (this.index == null)
                    throw new RTFJSError("No font index provided");
                if (this.fontname == null)
                    throw new RTFJSError("No font name provided");
                this._fonttbl.addSub(this);
                delete this._fonttbl;
            };
            cls.prototype.setAltFontName = function (name) {
                this.altfontname = name;
            };
            return cls;
        };
        var fonttblDestination = function () {
            var cls = function () {
                DestinationBase.call(this, "fonttbl");
                this._fonts = [];
                this._sub = null;
            };
            cls.prototype.sub = function () {
                var subCls = fonttblDestinationSub();
                return new subCls(this);
            };
            cls.prototype.apply = function () {
                Helper.log("[fonttbl] apply()");
                for (var idx in this._fonts) {
                    Helper.log("[fonttbl][" + idx + "] index = " + this._fonts[idx].fontname + " alternative: " + this._fonts[idx].altfontname);
                }
                inst._fonts = this._fonts;
                delete this._fonts;
            };
            cls.prototype.appendText = function (text) {
                this._sub.appendText(text);
                this._sub.apply();
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                if (keyword === "f") {
                    this._sub = this.sub();
                }
                this._sub.handleKeyword(keyword, param);
            };
            cls.prototype.addSub = function (sub) {
                this._fonts[sub.index] = sub;
            };
            return cls;
        };
        var genericSubTextPropertyDestination = function (name, parentDest, propOrFunc) {
            var cls = function () {
                DestinationTextBase.call(this, name);
            };
            cls.prototype = Object.create(DestinationTextBase.prototype);
            cls.prototype.apply = function () {
                var dest = findParentDestination(parentDest);
                if (dest == null)
                    throw new RTFJSError(this._name + " destination must be child of " + parentDest + " destination");
                if (dest[propOrFunc] == null)
                    throw new RTFJSError(this._name + " destination cannot find member + " + propOrFunc + " in " + parentDest + " destination");
                if (dest[propOrFunc] instanceof Function)
                    dest[propOrFunc](this.text);
                else
                    dest[propOrFunc] = this.text;
            };
            return cls;
        };
        var colortblDestination = function () {
            var cls = function () {
                DestinationBase.call(this, "colortbl");
                this._colors = [];
                this._current = null;
                this._autoIndex = null;
            };
            cls.prototype._startNewColor = function () {
                this._current = {
                    r: 0,
                    g: 0,
                    b: 0,
                    tint: 255,
                    shade: 255,
                    theme: null
                };
                return this._current;
            };
            cls.prototype.appendText = function (text) {
                var len = text.length;
                for (var i = 0; i < len; i++) {
                    if (text[i] != ";")
                        throw new RTFJSError("Error parsing colortbl destination");
                    if (this._current == null) {
                        if (this._autoIndex != null)
                            throw new RTFJSError("colortbl cannot define more than one auto color");
                        this._autoIndex = this._colors.length;
                        this._startNewColor();
                    }
                    else {
                        if (this._current.tint < 255 && this._current.shade < 255)
                            throw new RTFJSError("colortbl cannot define shade and tint at the same time");
                    }
                    this._colors.push(this._current);
                    this._current = null;
                }
            };
            var _validateColorValueRange = function (keyword, param) {
                if (param == null)
                    throw new RTFJSError(keyword + " has no param");
                if (param < 0 || param > 255)
                    throw new RTFJSError(keyword + " has invalid param value");
                return param;
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                if (this._current == null)
                    this._startNewColor();
                switch (keyword) {
                    case "red":
                        this._current.r = _validateColorValueRange(keyword, param);
                        return true;
                    case "green":
                        this._current.g = _validateColorValueRange(keyword, param);
                        return true;
                    case "blue":
                        this._current.b = _validateColorValueRange(keyword, param);
                        return true;
                    case "ctint":
                        this._current.tint = _validateColorValueRange(keyword, param);
                        return true;
                    case "cshade":
                        this._current.shade = _validateColorValueRange(keyword, param);
                        return true;
                    default:
                        if (keyword[0] == "c") {
                            this._current.theme = Helper._mapColorTheme(keyword.slice(1));
                            return true;
                        }
                        break;
                }
                Helper.log("[colortbl] handleKeyword(): unhandled keyword: " + keyword);
                return false;
            };
            cls.prototype.apply = function () {
                Helper.log("[colortbl] apply()");
                if (this._autoIndex == null)
                    this._autoIndex = 0;
                if (this._autoIndex >= this._colors.length)
                    throw new RTFJSError("colortbl doesn't define auto color");
                for (var idx in this._colors)
                    Helper.log("[colortbl] [" + idx + "] = " + this._colors[idx].r + "," + this._colors[idx].g + "," + this._colors[idx].b + " theme: " + this._colors[idx].theme);
                inst._colors = this._colors;
                inst._autoColor = this._autoIndex;
                delete this._colors;
            };
            return cls;
        };
        var stylesheetDestinationSub = function () {
            var _handleKeywordCommon = function (member) {
                var data = this[member];
                if (data == null)
                    this[member] = data = {};
                return function (keyword, param) {
                    Helper.log("[stylesheet:sub]." + member + ": unhandled keyword: " + keyword + " param: " + param);
                    return false;
                };
            };
            var cls = function (stylesheet) {
                DestinationBase.call(this, "stylesheet:sub");
                this._stylesheet = stylesheet;
                this.index = 0;
                this.name = null;
                this.handler = _handleKeywordCommon("paragraph");
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                switch (keyword) {
                    case "s":
                        this.index = param;
                        return true;
                    case "cs":
                        delete this.paragraph;
                        this.handler = _handleKeywordCommon("character");
                        this.index = param;
                        return true;
                    case "ds":
                        delete this.paragraph;
                        this.handler = _handleKeywordCommon("section");
                        this.index = param;
                        return true;
                    case "ts":
                        delete this.paragraph;
                        this.handler = _handleKeywordCommon("table");
                        this.index = param;
                        return true;
                }
                return this.handler(keyword, param);
            };
            cls.prototype.appendText = function (text) {
                if (this.name == null)
                    this.name = text;
                else
                    this.name += text;
            };
            cls.prototype.apply = function () {
                this._stylesheet.addSub({
                    index: this.index,
                    name: this.name
                });
                delete this._stylesheet;
            };
            return cls;
        };
        var stylesheetDestination = function () {
            var cls = function () {
                DestinationBase.call(this, "stylesheet");
                this._stylesheets = [];
            };
            cls.prototype.sub = function () {
                var subCls = stylesheetDestinationSub();
                return new subCls(this);
            };
            cls.prototype.apply = function () {
                Helper.log("[stylesheet] apply()");
                for (var idx in this._stylesheets)
                    Helper.log("[stylesheet] [" + idx + "] name: " + this._stylesheets[idx].name);
                inst._stylesheets = this._stylesheets;
                delete this._stylesheets;
            };
            cls.prototype.addSub = function (sub) {
                //Some documents will redefine stylesheets
                // if (this._stylesheets[sub.index] != null)
                //     throw new RTFJSError("Cannot redefine stylesheet with index " + sub.index);
                this._stylesheets[sub.index] = sub;
            };
            return cls;
        };
        var fieldDestination = function () {
            var cls = function () {
                DestinationBase.call(this, "field");
                this._haveInst = false;
                this._parsedInst = null; // FieldBase
                this._result = null;
            };
            cls.prototype.apply = function () {
                if (!this._haveInst)
                    throw new RTFJSError("Field has no fldinst destination");
                //A fldrslt destination should be included but is not required
                // if (this._result == null)
                //     throw new RTFJSError("Field has no fldrslt destination");
            };
            cls.prototype.setInst = function (inst) {
                this._haveInst = true;
                if (this._parsedInst != null)
                    throw new RTFJSError("Field cannot have multiple fldinst destinations");
                this._parsedInst = inst;
            };
            cls.prototype.getInst = function () {
                return this._parsedInst;
            };
            cls.prototype.setResult = function (inst) {
                if (this._result != null)
                    throw new RTFJSError("Field cannot have multiple fldrslt destinations");
                this._result = inst;
            };
            return cls;
        };
        var FieldBase = function (fldinst) {
            this._fldinst = fldinst;
        };
        FieldBase.prototype.renderFieldEnd = function (field, rtf, records) {
            if (records > 0) {
                rtf.addIns(function () {
                    this.popContainer();
                });
            }
        };
        var FieldHyperlink = function (fldinst, data) {
            FieldBase.call(this, fldinst);
            this._url = data;
        };
        FieldHyperlink.prototype = Object.create(FieldBase.prototype);
        FieldHyperlink.prototype.url = function () {
            return this._url;
        };
        FieldHyperlink.prototype.renderFieldBegin = function (field, rtf, records) {
            var self = this;
            if (records > 0) {
                rtf.addIns(function () {
                    var renderer = this;
                    var create = function () {
                        return renderer.buildHyperlinkElement(self._url);
                    };
                    var container;
                    if (inst._settings.onHyperlink != null) {
                        container = inst._settings.onHyperlink.call(inst, create, self);
                    }
                    else {
                        var elem = create();
                        container = {
                            element: elem,
                            content: elem
                        };
                    }
                    this.pushContainer(container);
                });
                return true;
            }
            return false;
        };
        var fldinstDestination = function () {
            var cls = function () {
                DestinationTextBase.call(this, "fldinst");
            };
            cls.prototype = Object.create(DestinationTextBase.prototype);
            cls.prototype.apply = function () {
                var field = findParentDestination("field");
                if (field == null)
                    throw new RTFJSError("fldinst destination must be child of field destination");
                field.setInst(this.parseType());
            };
            cls.prototype.parseType = function () {
                var sep = this.text.indexOf(" ");
                if (sep > 0) {
                    var data = this.text.substr(sep + 1);
                    if (data.length >= 2 && data[0] == "\"") {
                        var end = data.indexOf("\"", 1);
                        if (end >= 1)
                            data = data.substring(1, end);
                    }
                    var fieldType = this.text.substr(0, sep);
                    switch (fieldType) {
                        case "HYPERLINK":
                            return new FieldHyperlink(this, data);
                        default:
                            Helper.log("[fldinst]: unknown field type: " + fieldType);
                            break;
                    }
                }
            };
            return cls;
        };
        var fldrsltDestination = function () {
            var cls = function () {
                DestinationFormattedTextBase.call(this, "fldrslt");
            };
            cls.prototype = Object.create(DestinationFormattedTextBase.prototype);
            var baseApply = cls.prototype.apply;
            cls.prototype.apply = function () {
                var field = findParentDestination("field");
                if (field != null) {
                    field.setResult(this);
                }
                baseApply.call(this);
            };
            cls.prototype.renderBegin = function (rtf, records) {
                var field = findParentDestination("field");
                if (field != null) {
                    var inst = field.getInst();
                    if (inst != null)
                        return inst.renderFieldBegin(field, rtf, records);
                }
                return false;
            };
            cls.prototype.renderEnd = function (rtf, records) {
                var field = findParentDestination("field");
                if (field != null) {
                    var inst = field.getInst();
                    if (inst != null)
                        inst.renderFieldEnd(field, rtf, records);
                }
            };
            return cls;
        };
        var pictGroupDestination = function (legacy) {
            var cls = function () {
                DestinationTextBase.call(this, "pict-group");
                this._legacy = legacy;
            };
            cls.prototype = Object.create(DestinationTextBase.prototype);
            cls.prototype.isLegacy = function () {
                return this._legacy;
            };
            return cls;
        };
        var pictDestination = function () {
            var cls = function () {
                DestinationTextBase.call(this, "pict");
                this._type = null;
                this._blob = null;
                this._displaysize = {
                    width: null,
                    height: null
                };
                this._size = {
                    width: null,
                    height: null
                };
            };
            cls.prototype = Object.create(DestinationTextBase.prototype);
            var _setPropValueRequired = function (member, prop) {
                return function (param) {
                    if (param == null)
                        throw new RTFJSError("Picture property has no value");
                    Helper.log("[pict] set " + member + "." + prop + " = " + param);
                    var obj = (member != null ? this[member] : this);
                    obj[prop] = param;
                };
            };
            var _pictHandlers = {
                picw: _setPropValueRequired("_size", "width"),
                pich: _setPropValueRequired("_size", "height"),
                picwgoal: _setPropValueRequired("_displaysize", "width"),
                pichgoal: _setPropValueRequired("_displaysize", "height")
            };
            var _pictTypeHandler = {
                emfblip: (function () {
                    if (typeof EMFJS !== "undefined") {
                        return function () {
                            return {
                                load: function () {
                                    try {
                                        return new EMFJS.Renderer(this._blob);
                                    }
                                    catch (e) {
                                        if (e instanceof EMFJS.Error)
                                            return e.message;
                                        else
                                            throw e;
                                    }
                                },
                                render: function (img) {
                                    return img.render({
                                        width: Helper._twipsToPt(this._displaysize.width) + "pt",
                                        height: Helper._twipsToPt(this._displaysize.height) + "pt",
                                        wExt: this._size.width,
                                        hExt: this._size.width,
                                        xExt: this._size.width,
                                        yExt: this._size.height,
                                        mapMode: 8
                                    });
                                }
                            };
                        };
                    }
                    else {
                        return "";
                    }
                })(),
                pngblip: "image/png",
                jpegblip: "image/jpeg",
                macpict: "",
                pmmetafile: "",
                wmetafile: (function () {
                    if (typeof WMFJS !== "undefined") {
                        return function (param) {
                            if (param == null || param < 0 || param > 8)
                                throw new RTFJSError("Insufficient metafile information");
                            return {
                                load: function () {
                                    try {
                                        return new WMFJS.Renderer(this._blob);
                                    }
                                    catch (e) {
                                        if (e instanceof WMFJS.Error)
                                            return e.message;
                                        else
                                            throw e;
                                    }
                                },
                                render: function (img) {
                                    return img.render({
                                        width: Helper._twipsToPt(this._displaysize.width) + "pt",
                                        height: Helper._twipsToPt(this._displaysize.height) + "pt",
                                        xExt: this._size.width,
                                        yExt: this._size.height,
                                        mapMode: param
                                    });
                                }
                            };
                        };
                    }
                    else {
                        return "";
                    }
                })(),
                dibitmap: "",
                wbitmap: "" // TODO
            };
            cls.prototype.handleKeyword = function (keyword, param) {
                var handler = _pictHandlers[keyword];
                if (handler != null) {
                    handler.call(this, param);
                    return true;
                }
                var inst = this;
                var type = _pictTypeHandler[keyword];
                if (type != null) {
                    if (this._type == null) {
                        if (typeof type === "function") {
                            var info = type.call(this, param);
                            if (info != null) {
                                if (typeof info === "string") {
                                    this._type = info;
                                }
                                else {
                                    this._type = function () {
                                        var renderer = info.load.call(inst);
                                        if (renderer != null) {
                                            if (typeof renderer === "string")
                                                return renderer;
                                            return function () {
                                                return info.render.call(inst, renderer);
                                            };
                                        }
                                    };
                                }
                            }
                        }
                        else {
                            this._type = type;
                        }
                    }
                    return true;
                }
                return false;
            };
            cls.prototype.handleBlob = function (blob) {
                this._blob = blob;
            };
            cls.prototype.apply = function () {
                if (this._type == null)
                    throw new RTFJSError("Picture type unknown or not specified");
                //if (this._size.width == null || this._size.height == null)
                //    throw new RTFJSError("Picture dimensions not specified");
                //if (this._displaysize.width == null || this._displaysize.height == null)
                //    throw new RTFJSError("Picture display dimensions not specified");
                var pictGroup = findParentDestination("pict-group");
                var isLegacy = (pictGroup != null ? pictGroup.isLegacy() : null);
                var type = this._type;
                if (typeof type === "function") {
                    // type is the trampoline function that executes the .load function
                    // and returns a renderer trampoline that ends up calling the .render function
                    if (this._blob == null) {
                        this._blob = Helper._hexToBlob(this.text);
                        if (this._blob == null)
                            throw new RTFJSError("Could not parse picture data");
                        delete this.text;
                    }
                    var info = this;
                    var doRender = function (rendering) {
                        var pictrender = type.call(info);
                        if (pictrender != null) {
                            if (typeof pictrender === "string") {
                                Helper.log("[pict] Could not load image: " + pictrender);
                                if (rendering) {
                                    return this.buildPicture(pictrender, null);
                                }
                                else {
                                    inst.addIns(function () {
                                        this.picture(pictrender, null);
                                    });
                                }
                            }
                            else {
                                if (typeof pictrender !== "function")
                                    throw new RTFJSError("Expected a picture render function");
                                if (rendering) {
                                    return this.buildRenderedPicture(pictrender());
                                }
                                else {
                                    inst.addIns(function () {
                                        this.renderedPicture(pictrender());
                                    });
                                }
                            }
                        }
                    };
                    if (inst._settings.onPicture != null) {
                        inst.addIns((function (isLegacy) {
                            return function () {
                                var renderer = this;
                                var elem = inst._settings.onPicture.call(inst, isLegacy, function () {
                                    return doRender.call(renderer, true);
                                });
                                if (elem != null)
                                    this.appendElement(elem);
                            };
                        })(isLegacy));
                    }
                    else {
                        doRender(false);
                    }
                }
                else if (typeof type === "string") {
                    var text = this.text;
                    var blob = this._blob;
                    var doRender = function (rendering) {
                        var bin = blob != null ? Helper._blobToBinary(blob) : Helper._hexToBinary(text);
                        if (type !== "") {
                            if (rendering) {
                                return this.buildPicture(type, bin);
                            }
                            else {
                                inst.addIns(function () {
                                    this.picture(type, bin);
                                });
                            }
                        }
                        else {
                            if (rendering) {
                                return this.buildPicture("Unsupported image format", null);
                            }
                            else {
                                inst.addIns(function () {
                                    this.picture("Unsupported image format", null);
                                });
                            }
                        }
                    };
                    if (inst._settings.onPicture != null) {
                        inst.addIns((function (isLegacy) {
                            return function () {
                                var renderer = this;
                                var elem = inst._settings.onPicture.call(inst, isLegacy, function () {
                                    return doRender.call(renderer, true);
                                });
                                if (elem != null)
                                    this.appendElement(elem);
                            };
                        })(isLegacy));
                        ;
                    }
                    else {
                        doRender(false);
                    }
                }
                delete this.text;
            };
            return cls;
        };
        var requiredDestination = function (name) {
            return function () {
                DestinationBase.call(this, name);
            };
        };
        var destinations = {
            rtf: rtfDestination(),
            info: infoDestination(),
            title: metaPropertyDestination("title"),
            subject: metaPropertyDestination("subject"),
            author: metaPropertyDestination("author"),
            manager: metaPropertyDestination("manager"),
            company: metaPropertyDestination("company"),
            operator: metaPropertyDestination("operator"),
            category: metaPropertyDestination("category"),
            keywords: metaPropertyDestination("keywords"),
            doccomm: metaPropertyDestination("doccomm"),
            hlinkbase: metaPropertyDestination("hlinkbase"),
            generator: genericPropertyDestination("rtf", "generator"),
            creatim: metaPropertyTimeDestination("creatim"),
            revtim: metaPropertyTimeDestination("revtim"),
            printim: metaPropertyTimeDestination("printim"),
            buptim: metaPropertyTimeDestination("buptim"),
            fonttbl: fonttblDestination(),
            falt: genericSubTextPropertyDestination("falt", "fonttbl:sub", "setAltFontName"),
            colortbl: colortblDestination(),
            stylesheet: stylesheetDestination(),
            footer: requiredDestination("footer"),
            footerf: requiredDestination("footerf"),
            footerl: requiredDestination("footerl"),
            footerr: requiredDestination("footerr"),
            footnote: requiredDestination("footnote"),
            ftncn: requiredDestination("ftncn"),
            ftnsep: requiredDestination("ftnsep"),
            ftnsepc: requiredDestination("ftnsepc"),
            header: requiredDestination("header"),
            headerf: requiredDestination("headerf"),
            headerl: requiredDestination("headerl"),
            headerr: requiredDestination("headerr"),
            pict: pictDestination(),
            shppict: pictGroupDestination(false),
            nonshppict: pictGroupDestination(true),
            private1: requiredDestination("private1"),
            rxe: requiredDestination("rxe"),
            tc: requiredDestination("tc"),
            txe: requiredDestination("txe"),
            xe: requiredDestination("xe"),
            field: fieldDestination(),
            fldinst: fldinstDestination(),
            fldrslt: fldrsltDestination(),
        };
        var applyDestination = function (always) {
            var dest = parser.state.destination;
            if (dest != null) {
                if (always || parser.state.parent == null || parser.state.parent.destination != parser.state.destination) {
                    if (dest.apply != null)
                        dest.apply();
                    parser.state.destination = null;
                }
            }
        };
        var applyText = function () {
            if (parser.text.length > 0) {
                var dest = parser.state.destination;
                if (dest == null)
                    throw new RTFJSError("Cannot route text to destination");
                if (dest != null && dest.appendText != null && !parser.state.skipdestination)
                    dest.appendText(parser.text);
                parser.text = "";
            }
        };
        var pushState = function (forceSkip) {
            parser.state = new State(parser.state);
            if (forceSkip)
                parser.state.skipdestination = true;
            var dest = parser.state.destination;
            if (dest != null && !parser.state.skipdestination) {
                if (dest.sub != null) {
                    var sub = dest.sub();
                    if (sub != null)
                        parser.state.destination = sub;
                }
            }
        };
        var popState = function () {
            var state = parser.state;
            if (state == null)
                throw new RTFJSError("Unexpected end of state");
            applyText();
            if (state.parent == null || state.destination != state.parent.destination)
                applyDestination(true);
            parser.state = state.parent;
            if (parser.state !== null) {
                inst._ins.push((function (state) {
                    return function () {
                        this.setChp(new RenderChp(state.chp));
                    };
                })(parser.state));
                inst._ins.push((function (state) {
                    return function () {
                        this.setPap(new RenderPap(state.pap));
                    };
                })(parser.state));
            }
            return parser.state;
        };
        var changeDestination = function (name, param) {
            applyText();
            var handler = destinations[name];
            if (handler != null) {
                applyDestination(false);
                parser.state.destination = new handler(name, param);
                return true;
            }
            return false;
        };
        processKeyword = function (keyword, param) {
            var first = parser.state.first;
            if (first) {
                if (keyword == "*") {
                    parser.state.skipunknowndestination = true;
                    return;
                }
                parser.state.first = false;
            }
            //if (param != null)
            //    Helper.log("keyword " + keyword + " with param " + param);
            //else
            //    Helper.log("keyword " + keyword);
            if (parser.state.bindata > 0)
                throw new RTFJSError("Keyword encountered within binary data");
            // Reset if we unexpectedly encounter a keyword
            parser.state.skipchars = 0;
            switch (keyword) {
                case "\n":
                    return "\n";
                case "\r":
                    return "\r";
                case "tab":
                    return "\t";
                case "ldblquote":
                    return "“";
                case "rdblquote":
                    return "”";
                case "{":
                case "}":
                case "\\":
                    return keyword;
                case "uc":
                    if (param != null && param >= 0)
                        parser.state.ucn = param;
                    break;
                case "u":
                    if (param != null) {
                        if (param < 0)
                            param += 65536;
                        if (param < 0 || param > 65535)
                            throw new RTFJSError("Invalid unicode character encountered");
                        var symbol = SymbolTable[param.toString(16).substring(2)];
                        appendText(symbol !== undefined ? symbol : String.fromCharCode(param));
                        parser.state.skipchars = parser.state.ucn;
                    }
                    return;
                case "bin":
                    if (param == null)
                        throw new RTFJSError("Binary data is missing length");
                    if (param < 0)
                        throw new RTFJSError("Binary data with invalid length");
                    parser.state.bindata = param;
                    return;
                case "upr":
                    parseLoop(true, null); // skip the first sub destination (ansi)
                    // this will be followed by a \ud sub destination
                    return;
                case "ud":
                    return;
                default:
                    if (!parser.state.skipdestination) {
                        if (first) {
                            if (!changeDestination(keyword, param)) {
                                var handled = false;
                                var dest = parser.state.destination;
                                if (dest != null) {
                                    if (dest.handleKeyword != null)
                                        handled = dest.handleKeyword(keyword, param);
                                }
                                if (!handled && parser.state.skipunknowndestination)
                                    parser.state.skipdestination = true;
                            }
                        }
                        else {
                            applyText();
                            var dest = parser.state.destination;
                            if (dest != null) {
                                if (dest.handleKeyword != null)
                                    dest.handleKeyword(keyword, param);
                            }
                            else {
                                Helper.log("Unhandled keyword: " + keyword + " param: " + param);
                            }
                        }
                    }
                    return;
            }
            parser.state.skipdestination = false;
        };
        appendText = function (text) {
            // Handle characters not found in codepage
            text = text ? text : "";
            parser.state.first = false;
            if (parser.state.skipchars > 0) {
                var len = text.length;
                if (parser.state.skipchars >= len) {
                    parser.state.skipchars -= len;
                    return;
                }
                if (parser.state.destination == null || !parser.state.skipdestination)
                    parser.text += text.slice(parser.state.skipchars);
                parser.state.skipchars = 0;
            }
            else if (parser.state.destination == null || !parser.state.skipdestination) {
                parser.text += text;
            }
        };
        var applyBlob = function (blob) {
            parser.state.first = false;
            applyText();
            if (parser.state.skipchars > 0) {
                // \bin and all its data is considered one character for skipping purposes
                parser.state.skipchars--;
            }
            else {
                var dest = parser.state.destination;
                if (dest == null)
                    throw new RTFJSError("Cannot route binary to destination");
                if (dest != null && dest.handleBlob != null && !parser.state.skipdestination)
                    dest.handleBlob(blob);
            }
        };
        parseKeyword = function (process) {
            if (parser.state == null)
                throw new RTFJSError("No state");
            var param;
            var ch = parser.readChar();
            if (!Helper._isalpha(ch)) {
                if (ch == "\'") {
                    var hex = parser.readChar() + parser.readChar();
                    if (parser.state.pap.charactertype === Helper.CHARACTER_TYPE.DOUBLE) {
                        parser.readChar();
                        parser.readChar();
                        hex += parser.readChar() + parser.readChar();
                    }
                    param = Helper._parseHex(hex);
                    if (isNaN(param))
                        throw new RTFJSError("Could not parse hexadecimal number");
                    if (process != null) {
                        // Looking for current fonttbl charset
                        var codepage = parser.codepage;
                        if (parser.state.chp.hasOwnProperty("fontfamily")) {
                            var idx = parser.state.chp.fontfamily;
                            if (inst._fonts != undefined && inst._fonts[idx] != null && inst._fonts[idx].charset != undefined)
                                codepage = inst._fonts[idx].charset;
                        }
                        appendText(cptable[codepage].dec[param]);
                    }
                }
                else if (process != null) {
                    var text = process(ch, param);
                    if (text != null)
                        appendText(text);
                }
            }
            else {
                var keyword = ch;
                ch = parser.readChar();
                while (keyword.length < 30 && Helper._isalpha(ch)) {
                    keyword += ch;
                    ch = parser.readChar();
                }
                var num;
                if (ch == "-") {
                    num = "-";
                    ch = parser.readChar();
                }
                else {
                    num = "";
                }
                if (Helper._isdigit(ch)) {
                    do {
                        num += ch;
                        ch = parser.readChar();
                    } while (num.length < 20 && Helper._isdigit(ch));
                    if (num.length >= 20)
                        throw new RTFJSError("Param for keyword " + keyword + " too long");
                    param = parseInt(num, 10);
                    if (isNaN(param))
                        throw new RTFJSError("Invalid keyword " + keyword + " param");
                }
                if (ch != " ")
                    parser.unreadChar();
                if (process != null) {
                    var text = process(keyword, param);
                    if (text != null)
                        appendText(text);
                }
            }
        };
        parseLoop = function (skip, process) {
            try {
                var initialState = parser.state;
                main_loop: while (!parser.eof()) {
                    if (parser.state != null && parser.state.bindata > 0) {
                        var blob = parser.readBlob(parser.state.bindata);
                        parser.state.bindata = 0;
                        applyBlob(blob);
                    }
                    else {
                        var ch = parser.readChar();
                        switch (ch) {
                            case "\r":
                                continue;
                            case "\n":
                                parser.line++;
                                parser.column = 0;
                                continue;
                            case "{":
                                pushState(skip);
                                break;
                            case "}":
                                if (initialState == parser.state) {
                                    parser.unreadChar();
                                    break main_loop;
                                }
                                else if (popState() == initialState)
                                    break main_loop;
                                break;
                            case "\\":
                                parseKeyword(!skip ? process : null);
                                break;
                            default:
                                if (!skip)
                                    appendText(ch);
                                break;
                        }
                    }
                }
            }
            catch (error) {
                if (error instanceof RTFJSError) {
                    error.message += " (line: " + parser.line + "; column: " + parser.column + ")";
                }
                throw error;
            }
        };
        if (parser.data.length > 1 && String.fromCharCode(parser.data[0]) == "{") {
            parseLoop(false, processKeyword);
        }
        if (parser.version == null)
            throw new RTFJSError("Not a valid rtf document");
        if (parser.state != null)
            throw new RTFJSError("File truncated");
    };
    return Parser;
}());
export { Parser };
//# sourceMappingURL=Parser.js.map