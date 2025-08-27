import chakraTheme from "@chakra-ui/theme";

export const theme = {
  ...chakraTheme,
  styles: {
    ...chakraTheme.styles,
    global: {
      ...chakraTheme.styles.global,
      body: {
        fontFamily: "Montserrat, sans-serif",
      },
    },
  },
  breakpoints: {
    ...chakraTheme.breakpoints,
    xl: "70em",
    "2xl": "80em",
    "3xl": "96em",
  },
  colors: {
    ...chakraTheme.colors,
    blue: "#0084ff",
    grey: "#A0B6D7",
    background: "#1C1B45",
    lightBackground: "#1C1B45",
    greyText: "#75818D",
    modalBG: "rgba(98, 118, 148, 0.9)",
    modalOpaqueBG: "rgba(98, 118, 148, 1)",
  },
  fonts: {
    body: "Montserrat, sans-serif",
  },
};
