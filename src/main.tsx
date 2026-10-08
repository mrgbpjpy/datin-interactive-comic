/**
 * DATIN's browser entry point: mount the ComicReader view into index.html's root.
 * In the MVC-inspired organization, this is application bootstrap, not a model
 * or animation controller. React supplies StrictMode; react-dom supplies the
 * DOM renderer. ComicReader composes the experience and its separate R3F Canvas.
 * Concepts: JSX, module imports, development lifecycle checks, null assertions.
 * https://react.dev/reference/react-dom/client/createRoot
 * https://react.dev/reference/react/StrictMode
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ComicReader } from './views/ComicReader';
// The postfix ! asserts that the HTML root exists; it adds no runtime check.
// StrictMode can repeat setup/cleanup in development to expose lifecycle bugs.
createRoot(document.getElementById('root')!).render(<React.StrictMode><ComicReader /></React.StrictMode>);
