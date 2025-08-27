import '../styles/globals.css'
import '../styles/dialog-transition.css'
import '../styles/manual-trasnfer-svg.css'
import { useRouter } from "next/router";
import { IntercomProvider } from 'react-use-intercom';
import { SWRConfig } from 'swr'
import DatadogInit from "../components/datadog-init";

const INTERCOM_APP_ID = 'h5zisg78'
import "@rainbow-me/rainbowkit/styles.css";

function App({ Component, pageProps }) {
  const router = useRouter()
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 5000,
      }}
    >
      <DatadogInit />
      <IntercomProvider appId={INTERCOM_APP_ID} initializeDelay={2500}>
        <Component key={router.asPath} {...pageProps} />
      </IntercomProvider>
    </SWRConfig>)
}

export default App