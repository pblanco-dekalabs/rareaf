import LogicSig from 'algosdk/dist/types/src/logicsig'
import listing_template from '../contracts/listing.tmpl.teal'
import listing_var_positions from '../contracts/listing.tmpl.teal.json'
import platform_delegate_signed from '../contracts/platform.signed'
import {getAlgodClient} from './algorand'
import algosdk from 'algosdk'
import {platform_settings as ps} from './platform-conf'



export async function get_listing_sig(vars: any): Promise<LogicSig> {
    const compiled_program = await get_listing_compiled(vars)
    const program_bytes = new Uint8Array(Buffer.from(compiled_program.result, "base64"));
    return algosdk.makeLogicSig(program_bytes);
}

export async function get_platform_sig(): Promise<LogicSig> {
    const compiled_bytes        = await get_signed_platform_bytes()
    const delegate_program_bytes= new Uint8Array(Buffer.from(compiled_bytes, "base64"));
    return algosdk.logicSigFromByte(delegate_program_bytes)
}

export async function get_listing_source(vars: any) {
    return populate_contract(listing_template, vars)
}

export async function get_listing_compiled(vars: any) {
    const client = getAlgodClient()
    const populated = await populate_contract(listing_template, vars)
    return  client.compile(populated).do()
}

export async function get_approval_program(){
    return await get_file(ps.application.approval)
}

export async function get_clear_program(){
    return await get_file(ps.application.clear)
}

export async function get_signed_platform_bytes(){
    return await get_file(platform_delegate_signed)
}

export async function populate_contract(template, variables) {
    //Read the program, Swap vars, spit out the filled out tmplate
    let program = await get_file(template)
    for (let v in variables) {
        program = program.replace(v, variables[v])
    }
    return program
}

export async function get_file(program) {
    return await fetch(program)
        .then(response => checkStatus(response) && response.arrayBuffer())
        .then(buffer => {
            const td = new TextDecoder()
            return td.decode(buffer)
        }).catch(err => {
            console.error(err)
            return ""
        });
}

export function extract_vars(teal){
    let vars = {}
    for(let vname in listing_var_positions){
        const v = listing_var_positions[vname]
        vars[vname] = teal.subarray(v.start, v.start+v.length)
    }
    return vars
}

function checkStatus(response) {
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    return response;
}