const {
  IE_CONTRACT_ADDRESS = '0xc524b83bf85021e674a7c9f18f5381179fabaf6c',
  // FIXME Add back chain.love either when it's online or once onContractEvent
  // supports rpc failover
  // RPC_URLS = 'https://api.node.glif.io/rpc/v0,https://api.chain.love/rpc/v1',
  RPC_URLS = 'https://api.node.glif.io/rpc/v0',
  GLIF_TOKEN,
  VOYAGER_API = 'https://voyager.filstation.app'
} = process.env

const rpcUrls = RPC_URLS.split(',')
const RPC_URL = rpcUrls[Math.floor(Math.random() * rpcUrls.length)]
console.log(`Selected JSON-RPC endpoint ${RPC_URL}`)

const rpcHeaders = {}
if (RPC_URL.includes('glif')) {
  rpcHeaders.Authorization = `Bearer ${GLIF_TOKEN}`
}

export {
  IE_CONTRACT_ADDRESS,
  RPC_URL,
  VOYAGER_API,
  rpcHeaders
}
