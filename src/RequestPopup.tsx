'use strict'

import * as React from 'react'

import { Overlay, Button, Classes, Intent } from '@blueprintjs/core'

export const DefaultPopupProps = {
	isOpen: false,
	handleOption: (PopupPermission): void => {}
}

export enum PopupPermission {
    Proceed=1,
    Declined=2,
    Undecided=3
}

export type RequestPopupProps = {
    isOpen: boolean
    handleOption(PopupPermission)
};


export function RequestPopup(props: RequestPopupProps) {

    function handleDecline(){ props.handleOption(PopupPermission.Declined) }
    function handleProceed(){ props.handleOption(PopupPermission.Proceed) }

    return (
        <Overlay isOpen={props.isOpen} className={Classes.OVERLAY_CONTAINER} hasBackdrop={true} usePortal={false}>
            <div className={Classes.CARD}>
                Please click proceed to allow signing popup
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Button intent={Intent.DANGER} onClick={handleDecline} style={{ margin: "" }} text='Nevermind' />
                    <Button intent={Intent.SUCCESS} onClick={handleProceed} style={{ margin: "" }} text='Proceed' />
                </div>
            </div>
        </Overlay>
    )
}