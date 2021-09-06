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
		}
		catch (err) {
			console.error(err);
		}


		// const mintAuthority = new PublicKey("36nU9v2uQpVufZ2A9JPg2rxAkdZ4BpRzdNYvSFB7S78v");
		
		// //create new token mint
		// let mint = await splToken.Token.createMint(
		// 	connection,
		// 	wallet,
		// 	mintAuthority,
		// 	mintAuthority,
		// 	0,
		// 	splToken.TOKEN_PROGRAM_ID,
		// );

		// let fromTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
		// 	publicKey,
		// );
	
		// let signature: TransactionSignature = '';
		// try {
		//     const transaction = new Transaction().add(
		// 	SystemProgram.transfer({
		// 	    fromPubkey: publicKey,
		// 	    toPubkey: Keypair.generate().publicKey,
		// 	    lamports: 1,
		// 	})
		//     );
	
		//     signature = await sendTransaction(transaction, connection);
		//     console.log('info', 'Transaction sent:', signature);
	
		//     await connection.confirmTransaction(signature, 'processed');
		//     console.log('success', 'Transaction successful!', signature);
		// } catch (error: any) {
		//     console.log('error', `Transaction failed! ${error?.message}`, signature);
		//     return;
		// }
	    }, [connection, publicKey, adapter, wallet, signTransaction, sendTransaction]);

	return (
		<Button variant="contained" color="primary" onClick={onClick} /*disabled={!publicKey}*/ >
		    Mint NFT
		</Button>
	);
};

export default MintNFT;