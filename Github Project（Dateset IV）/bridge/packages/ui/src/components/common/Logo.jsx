import { Image } from "@chakra-ui/react";
import { uriToHttp } from "lib/helpers";
import React, { useState } from "react";

const BAD_SRCS = {};

export const Logo = ({ uri }) => {
  const [, refresh] = useState(0);

  if (uri) {
    const srcs = uriToHttp(uri);
    const src = srcs.find((s) => !BAD_SRCS[s]);

    if (src) {
      return (
        <Image
          src={src}
          onError={() => {
            if (src) BAD_SRCS[src] = true;
            refresh((i) => i + 1);
          }}
        />
      );
    }
  }

  return <Image />;
};
