#!/usr/bin/env python3

from pygments.lexers.javascript import JavascriptLexer
from pygments.style import Style
from pygments.token import *

from sphinx.highlighting import lexers


class CustomStyle(Style):
    default_style = ""
    styles = {
        Comment:                "#888888",
        Comment.Preproc:        "#888888",
        Comment.PreprocFile:    "#888888",
        Comment.Special:        "#888888",
        Error:                  "#ff0000",
        Generic:                "#888888",
        Keyword:                "#aa2222",
        Keyword.Constant:       "#226666",
        Keyword.Declaration:    "#882266",
        Keyword.Namespace:      "#884488",
        Keyword.Pseudo:         "#226622",
        Keyword.Reserved:       "#aa2222",
        Keyword.Type:           "#2266aa",
        Name:                   "#222222",
        Name.Builtin:           "#6644aa",
        Number:                 "#0022aa",
        Operator:               "#444488",
        Other:                  "#00ff00",
        Punctuation:            "#446688",
        String:                 "#448844",
        Text:                   "#000000",
        Whitespace:             "#eeeeee",
    }

    @classmethod
    def patch(cls, name):
        import sys
        import types
        import pygments.styles
        from pygments.styles import STYLE_MAP
        module = types.ModuleType(name)
        setattr(module, cls.__name__, cls)
        setattr(pygments.styles, name, module)
        sys.modules["pygments.styles." + name] = module
        pygments.styles.STYLE_MAP[name] = name + "::" + cls.__name__


class FixedFloatJavascriptLexer(JavascriptLexer):

    def __init__(self):
        self.tokens["root"].insert(0, (r"\d+[eE][-+]?\d+", Number.Float))
        super().__init__()


class ES2017Lexer(FixedFloatJavascriptLexer):
    ADDITIONAL_OPERATORS = {"=>"}
    ADDITIONAL_KEYWORDS = {"async", "await"}

    def get_tokens_unprocessed(self, text):
        for index, token, value in super().get_tokens_unprocessed(text):
            if token in Punctuation and value in self.ADDITIONAL_OPERATORS:
                token = Operator
            elif token in Name and value in self.ADDITIONAL_KEYWORDS:
                token = Keyword.Reserved
            yield index, token, value


class SolidityLexer(FixedFloatJavascriptLexer):
    ADDITIONAL_OPERATORS = {"=>"}
    ADDITIONAL_RSVD_KWDS = {"as", "from", "is", "returns", "pragma", "using"} \
                         | {"external", "internal", "public", "private"} \
                         | {"constant", "payable", "pure", "view"}
    ADDITIONAL_DECL_KWDS = {"assembly", "contract", "enum", "event",
                            "interface", "library", "mapping", "modifier",
                            "struct"} \
                         | {"memory", "storage"}
    ADDITIONAL_TYPE_KWDS = {"address", "bool", "byte", "bytes", "indexed",
                            "int", "mapping", "string", "uint"} \
                         | {f"bytes{n}" for n in range(1, 32+1)} \
                         | {f"int{n}" for n in range(8, 256+1, 8)} \
                         | {f"uint{n}" for n in range(8, 256+1, 8)} \
                         | {f"fixed{m}x{n}"
                            for m in range(8, 256+1, 8)
                            for n in range(80+1)} \
                         | {f"ufixed{m}x{n}"
                            for m in range(8, 256+1, 8)
                            for n in range(80+1)}
    ADDITIONAL_PSEU_KWDS = {"now", "seconds", "minutes", "hours", "days",
                            "weeks", "years"} \
                         | {"wei", "finney", "szabo", "ether"}
    ADDITIONAL_FNC_NAMES = {"assert", "require", "revert"} \
                         | {"addmod", "mulmod", "keccak256", "sha256", "sha3",
                            "ripemd160", "ecrecover"} \
                         | {"selfdestruct", "suicide"}

    def __init__(self):
        self.name = "Solidity"
        self.aliases = ["solidity", "sol"]
        self.filenames = ["*.sol"]
        super().__init__()

    def get_tokens_unprocessed(self, text):
        for index, token, value in super().get_tokens_unprocessed(text):
            if token in Punctuation and value in self.ADDITIONAL_OPERATORS:
                token = Operator
            elif token in Name:
                if value in self.ADDITIONAL_RSVD_KWDS:
                    token = Keyword.Reserved
                elif value in self.ADDITIONAL_DECL_KWDS:
                    token = Keyword.Declaration
                elif value in self.ADDITIONAL_TYPE_KWDS:
                    token = Keyword.Type
                elif value in self.ADDITIONAL_PSEU_KWDS:
                    token = Keyword.Pseudo
                elif value in self.ADDITIONAL_FNC_NAMES:
                    token = Name.Builtin
            yield index, token, value


def setup(app):
    from sphinx.builders.latex import LaTeXBuilder
    LaTeXBuilder.supported_image_types.insert(0, "image/x-eps")
    CustomStyle.patch("custom")
    lexers["javascript"] = ES2017Lexer()
    lexers["solidity"] = SolidityLexer()
