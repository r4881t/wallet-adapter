import { Button } from '@material-ui/core';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import  * as splToken from '@solana/spl-token';
import React, { FC, useCallback } from 'react';


const MintNFT: FC = () => {


	const { connection } = useConnection();
	const { publicKey, sendTransaction, signTransaction, wallet, adapter } = useWallet();
	//const notify = useNotify();

	const onClick = useCallback(async () => {

		try {

			// Ensure that priors are available
			if (!publicKey || !signTransaction || !wallet || !adapter) {
			console.log('error', 'Error in connection or wallet!');
			return;
			}
			else {
				console.log("connection success");
			}

			// Create Mint account keypair
			const mintAccount = Keypair.generate();

			// Token ID on testnet
			const tokenProgramId = new PublicKey(
				"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
			);

			// Associated Token ID on testnet, mainnet, devnet
			const assosiatedTokenProgramId = new PublicKey(
				"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
			);

			// Needed balance for mintAccount to be RentExempt
			const balanceNeeded = await splToken.Token.getMinBalanceRentForExemptMint(
				connection
			);

			// Create new TX
			const tx = new Transaction();
			
			// Add instruction to create account for the mint
			tx.add(
				SystemProgram.createAccount({
					fromPubkey: publicKey,
					newAccountPubkey: mintAccount.publicKey,
					lamports: balanceNeeded,
					space: splToken.MintLayout.span,
					programId: tokenProgramId,
					})
			);

			// Create initMintInstruction
			const initMintInstruction = await splToken.Token.createInitMintInstruction(
				tokenProgramId,
				mintAccount.publicKey,
				0,
				publicKey,
				publicKey
			);

			console.log(`mintAddress: ${mintAccount.publicKey}`);

			// Add initMintInstruction to the TX
			tx.add(initMintInstruction);
	
			// Get blockhash for the TX and add it to the TX
			tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

			// Add FeePayer which is the wallet
			tx.feePayer = publicKey;
			
			// Partially sign the TX with mintAccount pubKey
			tx.partialSign(mintAccount);
			console.log(`tx`, tx);

			// Send the signed TX
			const signature = await sendTransaction(tx, connection);
			console.log(`signature`, signature);
			if (signature) {
				// Confirm the signed TX
				const txAddress = await connection.confirmTransaction(
					signature,
					"confirmed"
				);
				console.log(txAddress);
			}
			else {
				console.log("Signature NOT found");
				return;
			}

			// step 2.
			const associatedAddress = await splToken.Token.getAssociatedTokenAddress(
				assosiatedTokenProgramId,	// associatedProgramId, SPL Associated Token program account
				tokenProgramId,			// programId, SPL Token program account
				mintAccount.publicKey,		// mint, Token mint account
				publicKey,			// owner, Owner .toString()of the new account
			);

			let info = await connection.getAccountInfo(associatedAddress);
			if (info == null || 
				!info.owner.equals(tokenProgramId) || 
				(info.data.length !== splToken.AccountLayout.span)) {
					const createAssociatedTokenAccInstruction = splToken.Token.createAssociatedTokenAccountInstruction(
						assosiatedTokenProgramId,
						tokenProgramId,
						mintAccount.publicKey,
						associatedAddress,
						publicKey,
						publicKey,
					);

					const tx = new Transaction();
					tx.add(createAssociatedTokenAccInstruction);
					tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
					tx.feePayer = publicKey;
					//tx.partialSign(mintAccount);
					console.log(`2tx`, tx);
					const signature = await sendTransaction(tx, connection);
					if (signature) {
						// Confirm the signed TX
						const txAddress = await connection.confirmTransaction(
							signature,
							"confirmed"
						);
						console.log(txAddress);
					} else {
						console.log("Signature not found 2.");
						return;
					}

			}

			// fetch the info again
			info = await connection.getAccountInfo(associatedAddress);

			if (info != null ){
				console.log("info");
				console.log(info);

				const data = Buffer.from(info.data);
				const accountInfo = splToken.AccountLayout.decode(data);
				accountInfo.address = associatedAddress;
				accountInfo.mint = new PublicKey(accountInfo.mint);
				accountInfo.owner = new PublicKey(accountInfo.owner);
				accountInfo.amount = splToken.u64.fromBuffer(accountInfo.amount);

				if (accountInfo.delegateOption === 0) {
					accountInfo.delegate = null;
					accountInfo.delegatedAmount = new splToken.u64(0);
				} else {
					accountInfo.delegate = new PublicKey(accountInfo.delegate);
					accountInfo.delegatedAmount = splToken.u64.fromBuffer(accountInfo.delegatedAmount);
				}
					
				accountInfo.isInitialized = accountInfo.state !== 0;
				accountInfo.isFrozen = accountInfo.state === 2;
					
				if (accountInfo.isNativeOption === 1) {
					accountInfo.rentExemptReserve = splToken.u64.fromBuffer(accountInfo.isNative);
					accountInfo.isNative = true;
				} else {
					accountInfo.rentExemptReserve = null;
					accountInfo.isNative = false;
				}
					
				if (accountInfo.closeAuthorityOption === 0) {
					accountInfo.closeAuthority = null;
				} else {
					accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
				}
					
				if (!accountInfo.mint.equals(mintAccount.publicKey)) {
					throw new Error(
						`Invalid account mint: ${JSON.stringify(
						accountInfo.mint,
						)} !== ${JSON.stringify(mintAccount.publicKey)}`,
					);
				}

				console.log("Account Info");
				console.log(accountInfo.mint.toString());

				const mintToInstruction = await splToken.Token.createMintToInstruction(
					tokenProgramId,			// programId, SPL Token program account
					mintAccount.publicKey,		// mint, Public key of the mint
					associatedAddress,		// dest, Public key of the account to mint to
					publicKey,			// authority, The mint authority
					[],				// multiSigners, Signing accounts if `authority` is a multiSig
					1				// amount, Amount to mint
				);

				const tx = new Transaction();
				tx.add(mintToInstruction);
				tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
				tx.feePayer = publicKey;
				//tx.partialSign(associatedAddress);
				console.log(`3tx`, tx);
				const signature = await sendTransaction(tx, connection);
				if (signature) {
					// Confirm the signed TX
					const txAddress = await connection.confirmTransaction(
						signature,
						"confirmed"
					);
					console.log(txAddress);
				} else {
					console.log("Signature not found 3");
					return;
				}

				const freezeMintInstruction = await splToken.Token.createSetAuthorityInstruction(
					tokenProgramId,			// programId, SPL Token program account
					mintAccount.publicKey,		// account, Public key of the account
					null,				// newAuthority, New authority of the account
					'MintTokens',			// authorityType, Type of authority to set
					publicKey,			// currentAuthority, Current authority of the specified type
					[],				// multiSigners, Signing accounts if `currentAuthority` is a multiSig
				);
				const removeMintAuthorityInstruction = await splToken.Token.createSetAuthorityInstruction(
					tokenProgramId,			// programId, SPL Token program account
					mintAccount.publicKey,		// account, Public key of the account
					null,				// newAuthority, New authority of the account
					'FreezeAccount',			// authorityType, Type of authority to set
					publicKey,			// currentAuthority, Current authority of the specified type
					[],				// multiSigners, Signing accounts if `currentAuthority` is a multiSig
				); 
				const txn = new Transaction();
				txn.add(freezeMintInstruction);
				txn.add(removeMintAuthorityInstruction);
				txn.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
				txn.feePayer = publicKey;
				//tx.partialSign(mintAccount);
				console.log(`4tx`, txn);
				const signatur = await sendTransaction(txn, connection);
				if (signatur) {
					// Confirm the signed TX
					const txAddress = await connection.confirmTransaction(
						signatur,
						"confirmed"
					);
					console.log(txAddress);
				} else {
					console.log("Signature not found 2.");
					return;
				}

			}
			else {
				console.log("Info is again null");
			}

		}
		catch (err) {
			console.error(err);
		}


	    }, [connection, publicKey, adapter, wallet, signTransaction, sendTransaction]);

	return (
		<Button variant="contained" color="primary" onClick={onClick} /*disabled={!publicKey}*/ >
		    Mint NFT
		</Button>
	);
};

export default MintNFT;