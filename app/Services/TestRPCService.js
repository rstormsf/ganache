import EventHandler from './TestRPCService/EventHandler'
import EventEmitter from 'events'
import TestRPC from 'ganache-core'
import BlockFetcher from './TestRPCService/BlockFetcher'
import AccountDetailFetcher from './TestRPCService/AccountDetailFetcher'
import TxFetcher from './TestRPCService/TxFetcher'
import autobind from 'class-autobind'

export default class TestRPCService extends EventEmitter {
  constructor (ipcMain, webView) {
    super()
    this.ipcMain = ipcMain
    this.webView = webView

    this.testRpc = null
    this.web3 = null
    this.host = null
    this.port = null
    this.stateManager = null
    this.blockFetcher = null

    autobind(this)

    this.eventHandler = new EventHandler(this)

    console.log('Starting TestRPCService')
  }

  log = (message) => {
    console.log(message)
    this.webView.send('APP/TESTRPCLOG', {message, level: 'log'})
  }

  info = (message) => {
    console.info(message)
    this.webView.send('APP/TESTRPCLOG', {message, level: 'info'})
  }

  warning = (message) => {
    console.warning(message)
    this.webView.send('APP/TESTRPCLOG', {message, level: 'warning'})
  }

  error = (message) => {
    console.error(message)
    this.webView.send('APP/TESTRPCLOG', {message, level: 'error'})
  }

  initializeTestRpc (opts) {
    this.testRpc = TestRPC.server(opts)
    this.testRpc.listen(opts.port, async (err, stateManager) => {
      if (err) {
        this.testRpcService.webView.send('APP/FAILEDTOSTART', err)
        console.log('ERR: ', err)
      }

      this.port = opts.port
      this.host = 'localhost'
      this.stateManager = stateManager
      this.blockFetcher = new BlockFetcher(this.stateManager)
      this.accountFetcher = new AccountDetailFetcher(this.stateManager)
      this.txFetcher = new TxFetcher(this.stateManager)

      const blockChainState = await this._getBlockchainState()
      this.webView.send('APP/TESTRPCSTARTED', blockChainState)

      this.emit('testRpcServiceStarted', this)
      this.log(`GANACHE STARTED: LISTENING ON http://${this.host}:${this.port}`)
      this.refreshTimer = setInterval(this.eventHandler._handleGetBlockchainState, 1000)
    })
  }

  async _getBlockchainState () {
    const currentBlockNumber = await this.blockFetcher.getCurrentBlockNumber()
    let blockChainState = await this.blockFetcher.buildBlockChainState(this.txFetcher._marshallTransaction)

    blockChainState.transactions = await this.txFetcher.getRecentTransactions(currentBlockNumber, this.blockFetcher)
    blockChainState.accounts = await this.accountFetcher.getAccountInfo()
    return blockChainState
  }
}
