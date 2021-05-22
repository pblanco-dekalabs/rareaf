import { platform_settings as ps } from './platform-conf'
import { get_listing_compiled, get_signed_platform_bytes } from './contracts'
import {
    getAlgodClient, sendWait, sendWaitGroup, logicSign,
    get_asa_cfg_txn, get_asa_xfer_txn, get_asa_optin_txn, get_pay_txn, download_txns, get_app_call_txn, uintToB64String
} from './algorand'
import algosdk, { assignGroupID, Transaction } from 'algosdk';
import { Wallet } from '../wallets/wallet';
import NFT from './nft'

import {Method}  from './application'

class Listing {
    asset_id: number
    price: number

    creator_addr: string
    contract_addr: string

    nft: NFT

    source: string

    constructor(price: number, asset_id: number, creator_addr: string, contract_addr?: string) {
        this.price = price
        this.asset_id = asset_id
        this.creator_addr = creator_addr
        this.contract_addr = contract_addr
    }

    getEncodedVars() {
        // Encode vars for inclusion in contract
        const var_id = uintToB64String(this.asset_id) 
        const var_addr = Buffer.from(algosdk.decodeAddress(this.creator_addr).publicKey).toString('base64')

        return [var_id, var_addr]
    }

    getVars() {
        const [var_id, var_addr] = this.getEncodedVars()

        return {
            TMPL_PLATFORM_ID: ps.token.id,
            TMPL_PLATFORM_FEE: ps.fee,
            TMPL_PLATFORM_ADDR: ps.address,

            TMPL_ASSET_ID: `base64(${var_id})`,
            TMPL_CREATOR_ADDR: `base64(${var_addr})`
        }
    }

    async getCompiledProgram() {
        return get_listing_compiled(this.getVars())
    }

    async getLsig() {
        const compiled_program = await this.getCompiledProgram()
        const program_bytes = new Uint8Array(Buffer.from(compiled_program.result, "base64"));
        return algosdk.makeLogicSig(program_bytes);
    }

    async doCreate(wallet: Wallet) {

        this.creator_addr = wallet.getDefaultAccount()

        const compiled = await this.getCompiledProgram()
        this.contract_addr = compiled.hash;

        //APP_CALL=app_listing_create.txn           
        const args = [ Method.Create, uintToB64String(this.price), compiled.result]

        const app_call_txn  = new Transaction(await get_app_call_txn(false, this.creator_addr, args))
        const seed_txn      = new Transaction(await get_pay_txn(false, this.creator_addr, this.contract_addr, ps.seed))
        const asa_opt_in    = new Transaction(await get_asa_optin_txn(false, this.contract_addr, this.asset_id))
        const price_opt_in  = new Transaction(await get_asa_optin_txn(false, this.contract_addr, ps.token.id))
        const price_send    = new Transaction(await get_asa_xfer_txn(false, ps.address, this.contract_addr, ps.token.id, this.price) )
        const asa_send      = new Transaction(await get_asa_xfer_txn(false, this.creator_addr, this.contract_addr, this.asset_id, 1))
        const asa_cfg       = new Transaction(await get_asa_cfg_txn(false, this.creator_addr, this.asset_id, {
            assetManager: this.contract_addr, 
            assetReserve: this.contract_addr, 
            assetFreeze:  this.contract_addr, 
            assetClawback:this.contract_addr
        }))

        const create_group = [app_call_txn, seed_txn, asa_opt_in, price_opt_in, asa_send, price_send, asa_cfg]
        algosdk.assignGroupID(create_group)

        console.log(create_group)

        const [s_app_call_txn, s_seed_txn, s_asa_send, s_asa_cfg] = await wallet.signTxn([app_call_txn, seed_txn, asa_send, asa_cfg])


        const listing_lsig   = await this.getLsig()
        const s_asa_opt_in   = algosdk.signLogicSigTransactionObject(asa_opt_in,  listing_lsig);
        const s_price_opt_in = algosdk.signLogicSigTransactionObject(price_opt_in,listing_lsig);

        const compiled_bytes        = await get_signed_platform_bytes()
        const delegate_program_bytes= new Uint8Array(Buffer.from(compiled_bytes, "base64"));
        const platform_lsig         = algosdk.logicSigFromByte(delegate_program_bytes)
        const s_price_send          = algosdk.signLogicSigTransactionObject(price_send,  platform_lsig)            

        const combined = [
            s_app_call_txn, s_seed_txn, s_asa_opt_in, s_price_opt_in, 
            s_asa_send, s_price_send,  s_asa_cfg 
        ]

        console.log(combined)

        return await sendWaitGroup(combined)
    }

    async doTag() {

    }

    async doUntag() {

    }

    async doPriceIncrease() {

    }

    async doPriceDecrease() {

    }

    async doDelete() {

    }

    async doPurchase() {

    }







    //async createListing (wallet: Wallet) {
    //    const client = await getAlgodClient()

    //    this.creator_addr = wallet.getDefaultAccount()

    //    // Make logic sig for listing contract
    //    const compiled_program  = await this.getCompiledProgram()
    //    const program_bytes     = new Uint8Array(Buffer.from(compiled_program.result , "base64"));
    //    const lsig              = algosdk.makeLogicSig(program_bytes);   

    //    this.contract_addr =  compiled_program.hash

    //    // Seed listing contract account
    //     const seed_txn = await get_pay_txn(false, this.creator_addr, this.contract_addr, ps.seed)
    //     const stxn = await wallet.sign(seed_txn)
    //     await sendWait(stxn)

    //    
    //     // TODO: check if already opted in
    //     let nft_optin   = await get_asa_optin_txn(true, this.contract_addr, this.asset_id)
    //     nft_optin       = algosdk.signLogicSigTransactionObject(new algosdk.Transaction(nft_optin), lsig);
    //     await sendWait(nft_optin)

    //     let platform_optin  = await get_asa_optin_txn(true, this.contract_addr, ps.token.id)
    //     platform_optin      = algosdk.signLogicSigTransactionObject(new algosdk.Transaction(platform_optin), lsig);
    //     await sendWait(platform_optin)

    //    //// Fund listing
    //    const compiled_bytes                = await get_signed_platform_bytes()
    //    const [var_price, var_id, var_addr] = this.getEncodedVars()

    //    const delegate_program_bytes= new Uint8Array(Buffer.from(compiled_bytes, "base64"));
    //    const del_sig               = algosdk.logicSigFromByte(delegate_program_bytes)
    //    del_sig.args                = [
    //        new Uint8Array(Buffer.from(var_price, "base64")), 
    //        new Uint8Array(Buffer.from(var_id, "base64")), 
    //        program_bytes 
    //    ]

    //    let asa_send      = await get_asa_xfer_txn(false, this.creator_addr, this.contract_addr, this.asset_id, 1)
    //    let asa_cfg       = await get_asa_cfg_txn(false, this.creator_addr, this.asset_id, {
    //        assetManager: this.contract_addr, 
    //        assetReserve: this.contract_addr, 
    //        assetFreeze:  this.contract_addr, 
    //        assetClawback:this.contract_addr
    //    })
    //    let pay_txn       = await get_pay_txn(false, this.creator_addr, this.contract_addr, ps.seed)

    //    let platform_send = await get_asa_xfer_txn(true, ps.address, this.contract_addr, ps.token.id, 1)

    //    const fund_txn_group = [asa_send, asa_cfg, pay_txn, platform_send]
    //    const grouped = algosdk.assignGroupID(fund_txn_group)
    //    for(let x=0; x<fund_txn_group.length; x++){ fund_txn_group[x].group = Array.from(grouped[x].group) }

    //    //TODO: Yikes
    //    platform_send = new Transaction(platform_send)
    //    platform_send.group = grouped[3].group

    //    console.log(platform_send)

    //    const s_platform_send = algosdk.signLogicSigTransactionObject(platform_send, del_sig) 

    //    const s_asa_send      = await wallet.sign(asa_send)
    //    const s_asa_cfg       = await wallet.sign(asa_cfg)
    //    const s_seed_txn      = await wallet.sign(pay_txn)

    //    await sendWaitGroup([s_asa_send, s_asa_cfg, s_seed_txn, s_platform_send])
    //}

    //async destroyListing(wallet: Wallet){
    //    const platform_close = await get_asa_xfer_txn(false, this.contract_addr, ps.address, ps.token.id, 0)
    //    platform_close.closeRemainderTo = ps.address


    //    const asa_cfg = await get_asa_cfg_txn(true, this.creator_addr, this.asset_id, {
    //        assetManager: this.creator_addr, 
    //        assetReserve: this.creator_addr, 
    //        assetFreeze:  this.creator_addr, 
    //        assetClawback:this.creator_addr
    //    })
    //    
    //    const nft_close = await get_asa_xfer_txn(false, this.contract_addr, this.creator_addr, this.asset_id, 0)
    //    nft_close.closeRemainderTo = this.creator_addr

    //    const algo_close = await get_pay_txn(false, this.contract_addr, this.creator_addr, 0)
    //    algo_close.closeRemainderTo = this.creator_addr

    //    const txns = algosdk.assignGroupID([platform_close, nft_close, asa_cfg, algo_close])

    //    const lsig = await this.getLsig()

    //    const s_platform_close = algosdk.signLogicSigTransactionObject(txns[0], lsig);
    //    const s_nft_close      = algosdk.signLogicSigTransactionObject(txns[1], lsig);
    //    const s_asa_cfg        = algosdk.signLogicSigTransactionObject(txns[2], lsig);
    //    const s_algo_close     = algosdk.signLogicSigTransactionObject(txns[3], lsig);

    //    await download_txns("grouped.txns", [s_platform_close.blob, s_nft_close.blob, s_asa_cfg.blob, s_algo_close.blob])
    //    await sendWaitGroup([s_platform_close, s_nft_close, s_asa_cfg, s_algo_close])
    //}


    //async purchaseListing(wallet: Wallet){
    //    const client = getAlgodClient()

    //    const buyer_addr = wallet.getDefaultAccount()

    //    const nft_optin = await get_asa_optin_txn(false, buyer_addr, this.asset_id)
    //    const payment   = await get_pay_txn(false, buyer_addr, this.creator_addr)

    //    let nft_xfer = await get_asa_xfer_txn(false, this.contract_addr,  buyer_addr, 1)
    //    nft_xfer.closeRemainderTo = buyer_addr

    //    const asa_cfg = await get_asa_cfg_txn(true, this.creator_addr, this.asset_id, {
    //        manager: this.creator_addr, 
    //        reserve: this.creator_addr, 
    //        freeze:  this.creator_addr, 
    //        clawback:this.creator_addr
    //    })

    //    let platform_xfer = await get_asa_xfer_txn(false, this.contract_addr, ps.address, 1)
    //    platform_xfer.closeRemainderTo = ps.address

    //    let platform_fee = await get_pay_txn(false, this.contract_addr, ps.address, ps.fee)
    //    platform_fee.closeRemainderTo = this.creator_addr

    //    const purchase_group = [nft_optin, payment, asa_cfg, nft_xfer, platform_xfer, platform_fee]
    //    algosdk.assignGroupID(purchase_group)

    //    const lsig = await this.getLsig()

    //    const s_nft_optin       = await wallet.sign(nft_optin)
    //    const s_payment         = await wallet.sign(payment)

    //    const s_asa_cfg         = algosdk.signLogicSigTransactionObject(new algosdk.Transaction(asa_cfg), lsig);
    //    const s_nft_xfer        = algosdk.signLogicSigTransactionObject(new algosdk.Transaction(nft_xfer), lsig);
    //    const s_platform_xfer   = algosdk.signLogicSigTransactionObject(new algosdk.Transaction(platform_xfer), lsig);
    //    const s_platform_fee    = algosdk.signLogicSigTransactionObject(new algosdk.Transaction(platform_fee), lsig);

    //    await sendWaitGroup([s_nft_optin, s_payment, s_asa_cfg, s_nft_xfer, s_platform_xfer, s_platform_fee])
    //}
}

export default Listing;