import { Wallet } from '../wallets/wallet'
import { getNFTFromMetadata } from './ipfs'
import { Transaction } from 'algosdk'
import { sendWait, getSuggested } from './algorand'
import { get_asa_create_txn, get_asa_destroy_txn} from './transactions'
import { platform_settings as ps } from './platform-conf'
import { showErrorToaster } from '../Toaster'

export class NFT {
    asset_id: number // ASA idx in algorand
    manager: string  // Current manager of the token representing this NFT
    url: string      // URL of metadata json

    metadata: NFTMetadata

    constructor(metadata: NFTMetadata, asset_id?: number, manager?: string) {
        this.metadata = metadata
        this.asset_id = asset_id
        this.manager = manager
    }

    async createToken(wallet: Wallet) {
        const creator = wallet.getDefaultAccount()
        const suggested = await getSuggested(10)
        const create_txn = new Transaction(await get_asa_create_txn(suggested, creator, NFT.metaUrl(this.url)))
        const [s_create_txn] = await wallet.signTxn([create_txn])
        return await sendWait([s_create_txn])
    }

    async destroyToken(wallet: Wallet) {
        const creator = wallet.getDefaultAccount()
        const suggested = await getSuggested(10)
        const destroy_txn = new Transaction(await get_asa_destroy_txn(suggested, creator, this.asset_id))
        const [s_destroy_txn] = await wallet.signTxn([destroy_txn])
        return await sendWait([s_destroy_txn])
    }


    imgSrc(): string {
        if (this.metadata.image !== undefined && this.metadata.image != "")
            return NFT.resolveUrl(this.metadata.image)

        return "https://via.placeholder.com/500"
    }

    explorerSrc(): string {
        const net = ps.algod.network == "mainnet" ? "" : ps.algod.network + "."
        return "https://" + net + ps.explorer + "/asset/" + this.asset_id
    }

    static resolveUrl(url: string): string {
        const [protocol, uri] = url.split("://")

        switch(protocol){
            case "ipfs":
                return ps.ipfs.display + uri
            case "algorand":
                //TODO: create url to request note field?
                showErrorToaster("No url resolver for algorand protocol string yet")
                return 
            case "http":
                return url
        }

        showErrorToaster("Unknown protocol: " + protocol)

        return  ""
    }

    static metaUrl(url: string): string {
        return NFT.resolveUrl(url + "/metadata.json")
    }

    static async fromToken(token: any): Promise<NFT> {

        const nft = await getNFTFromMetadata(token['params']['url'])

        if (nft===undefined) return undefined;

        nft.asset_id = token['index']
        nft.manager = token['params']['manager']
        return nft
    }

    static emptyNFT(): NFT {
        return new NFT(emptyMetadata())
    }
}


export type NFTMetadata = {
    name: string
    description: string
    image: string
    properties: {
        file: {
            name: string
            type: string
            size: number
        }
        artist: string
    }
}

export function emptyMetadata(): NFTMetadata {
    return {
        name: "",
        description: "",
        image: "",
        properties: {
            file: {
                name: "",
                type: "",
                size: 0,
            },
            artist: "",
        }
    };
}