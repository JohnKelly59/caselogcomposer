// pages/_app.js
import { SessionProvider } from "next-auth/react";
import { CssBaseline } from "@mui/material";
import Head from "next/head";

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Head>
        <title>Case Log Composer</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <CssBaseline />
      <Component {...pageProps} />
    </SessionProvider>
  );
}
