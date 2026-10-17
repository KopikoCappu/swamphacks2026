# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Styling the web app

Edit **`app/src/styles/global.css`**. It is imported once in `app/index.web.js`, so rules apply across all web routes without importing CSS into each page. Existing Markdown/KaTeX styles live there too.

Pages and React Native UI elements expose stable `data-testid` selectors in the browser. Find their `testID` props in the source, or inspect an element in browser DevTools. Names follow `<component>-<style-name>`, for example:

```css
/* Notes page heading */
[data-testid="notes-home-brand"] {
  font-size: 28px !important;
}

/* Every instance of a toolbar button */
[data-testid="toolbar-icon-btn"] {
  border-radius: 12px !important;
}

/* AI chat text, including rendered Markdown */
[data-testid^="agent-panel-"] {
  font-family: Georgia, serif !important;
}
.ib-rich {
  font-family: Georgia, serif;
}
```

Use `!important` to override existing inline React Native properties. Target text elements directly for fonts/colors because React Native text does not always inherit them from its container. `.ib-rich` targets rendered Markdown and `.ib-math` targets rendered equations. Repeated elements share selectors, so one rule styles every instance. For new UI, add a descriptive `testID="my-component-label"` to its React Native element, then style `[data-testid="my-component-label"]` here; DOM elements can use `className` normally.

CSS affects **web only**. Native iOS/Android styling stays in `StyleSheet` and `app/src/lib/theme.ts`. Skia canvas contents (ink, paper lines, previews, selection graphics) are drawn pixels/vectors, not DOM elements: customize those through component props, the note's paper/background controls, or drawing code. CSS can style the canvas container and text overlays.
