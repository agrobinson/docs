import * as t from "../types";
import * as path from "path";
import {parse} from "url";

const IS_URL_ABSOLUTE_REGEX = /^https?:\/\//i;

const linkTags = {
  a: true,
  "amplify-card": true,
  "docs-card": true,
  "docs-internal-link-button": true,
  "docs-in-page-link": true,
};

const validLinkExtensions = {
  svg: true,
  jpg: true,
  jpeg: true,
  png: true,
  gif: true,
  md: true,
};

const getRoute = (
  url: string,
  transformerProps: t.TransformerProps,
): string => {
  const parsedURL = parse(url);
  const {hash} = parsedURL;
  let {path: urlPath} = parsedURL;

  if (urlPath) {
    if (urlPath.includes("#")) {
      urlPath = urlPath.split("#").shift() as string;
    }
    let query = "";
    if (urlPath.includes("/q/")) {
      const pieces = urlPath.split("/q/");
      urlPath = pieces.shift() as string;
      const paramEntry = (pieces.shift() as string).split("/");
      query = `/q/${paramEntry[0]}/${paramEntry[1]}`;
    }
    const pathDeduction = transformerProps.ctx.resolvePathDeduction(
      urlPath,
      transformerProps.srcPath,
    );
    if (pathDeduction.route) {
      return `${pathDeduction.route}${query}${hash || ""}`;
    } else if (pathDeduction.destinationPath) {
      const pieces = path
        .relative(
          transformerProps.ctx.config.outDir,
          pathDeduction.destinationPath,
        )
        .split(path.sep);
      pieces.shift();
      pieces.shift();
      return `/${pieces.join(path.sep)}`;
    }
  }
  return "";
};

export const links: t.Transformer = (transformerProps: t.TransformerProps) => {
  const {node, lexicalScope} = transformerProps;

  if (Array.isArray(node) && node[0] && linkTags[node[0]]) {
    const [tagName, props, ...children] = node;
    if (props === undefined || props === null) {
      throw new Error(
        `Encountered "${tagName}" element without required prop \`href\``,
      );
    }

    let url = (props.href || props.url) as string;
    if (url) {
      const isURLExternal = IS_URL_ABSOLUTE_REGEX.test(url);

      if (!isURLExternal) {
        // in page links (hash-only url)
        if (url.startsWith("#")) {
          lexicalScope.update([
            "docs-in-page-link",
            {targetId: url.substr(1)},
            ...children,
          ]);
          return;
        }

        if (!url.startsWith("~")) {
          url = `~${url.startsWith("/") ? "" : "/"}${url}`;
        }
      }

      const route = isURLExternal ? url : getRoute(url, transformerProps);

      let finalTagName = tagName;
      const finalProps: Record<string, unknown> = {...props};

      switch (tagName) {
        case "a": {
          finalTagName = isURLExternal
            ? "amplify-external-link"
            : "docs-internal-link";
          finalProps.href = route;
          break;
        }

        case "docs-card":
        case "amplify-card": {
          finalProps.url = route;

          // to satisfy module redirect requirement
          const urlOverrideForMobileFilter = props[
            "url-override-for-mobile-filter"
          ] as string | undefined;
          if (urlOverrideForMobileFilter) {
            const urlOverrideForMobileFilterIsExternal = IS_URL_ABSOLUTE_REGEX.test(
              urlOverrideForMobileFilter,
            );
            const routeOverrideForMobileFilter = urlOverrideForMobileFilterIsExternal
              ? urlOverrideForMobileFilter
              : getRoute(urlOverrideForMobileFilter, transformerProps);
            if (routeOverrideForMobileFilter) {
              finalProps[
                "url-override-for-mobile-filter"
              ] = routeOverrideForMobileFilter;
            }
          }

          break;
        }

        case "docs-internal-link-button": {
          finalProps.href = route;
          break;
        }
      }

      lexicalScope.update([finalTagName, finalProps, ...children]);
    }
  }
};
