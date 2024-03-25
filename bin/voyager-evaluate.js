import * as Sentry from '@sentry/node'
import { IE_CONTRACT_ADDRESS, RPC_URL, rpcHeaders } from '../lib/config.js'
import { startEvaluate } from '../index.js'
import { fetchRoundDetails } from '../lib/voyager-api.js'
import assert from 'node:assert'
import { ethers } from 'ethers'
import { fileURLToPath } from 'node:url'
import { newDelegatedEthAddress } from '@glif/filecoin-address'
import { recordTelemetry } from '../lib/telemetry.js'
import fs from 'node:fs/promises'
import { fetchMeasurements } from '../lib/preprocess.js'

const {
  SENTRY_ENVIRONMENT = 'development',
  WALLET_SEED
} = process.env

Sentry.init({
  dsn: 'https://771aa314823e728793ac4cb59d25beab@o1408530.ingest.us.sentry.io/4506870057598976',
  environment: SENTRY_ENVIRONMENT,
  // Performance Monitoring
  tracesSampleRate: 0.1 // Capture 10% of the transactions
})

assert(WALLET_SEED, 'WALLET_SEED required')

const fetchRequest = new ethers.FetchRequest(RPC_URL)
fetchRequest.setHeader('Authorization', rpcHeaders.Authorization || '')
const provider = new ethers.JsonRpcProvider(
  fetchRequest,
  null,
  { batchMaxCount: 1 }
)
const signer = ethers.Wallet.fromPhrase(WALLET_SEED, provider)
console.log(
  'Wallet address:',
  signer.address,
  newDelegatedEthAddress(signer.address, 'f').toString()
)
const ieContract = new ethers.Contract(
  IE_CONTRACT_ADDRESS,
  JSON.parse(
    await fs.readFile(
      fileURLToPath(new URL('../lib/abi.json', import.meta.url)),
      'utf8'
    )
  ),
  provider
)
const ieContractWithSigner = ieContract.connect(signer)

await startEvaluate({
  ieContract,
  ieContractWithSigner,
  provider,
  rpcUrl: RPC_URL,
  rpcHeaders,
  fetchMeasurements,
  fetchRoundDetails,
  recordTelemetry,
  logger: console
})
