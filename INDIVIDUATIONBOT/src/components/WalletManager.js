const { EmbedBuilder, ActionRowBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, ButtonBuilder, TextInputStyle } = require("discord.js");
const { SlashCommandBuilder, quote} = require("@discordjs/builders")
const { Database } = require("../database/Database.js");
const { ModuleManager } = require("./ModuleManager");
const { Network, Alchemy } = require('alchemy-sdk');
const request = require('request');
const contractLibrary = require("../config/contractsLibrary.json");
var Web3 = require("web3")


class WalletClubsBalance {
    constructor(wallet=null, contract=null, balance=null,roleName=null, roleID) {
        this.wallet = wallet;
        this.contract = contract;
        this.balance = balance;
        this.roleID = roleID;
        this.roleName = roleName;
    }
}


class WalletManager{
    constructor(interaction=null, client=null, config=null) {
        this.interaction = interaction;
        this.client = client;
        this.config = config;

        if(interaction !== null) {
            this.mm = new ModuleManager(client, config);
            this.db = new Database(config);
        }
    }

    loadCommands() {
        return [
            new SlashCommandBuilder()
            .setName("wallet")
            .setDescription("Add Wallet.")
            .addStringOption(option =>
                option.setName("wallet")
                    .setDescription("Wallet Address")
                    .setRequired(true)
            ),
            new SlashCommandBuilder()
            .setName("badges")
            .setDescription("Refresh Wallet.")
            .addStringOption(option =>
                option.setName("wallet")
                    .setDescription("Wallet Address")
                    .setRequired(true)
            ),
        ]
    }

    async on() {
        if(this.interaction.isChatInputCommand()) {
            switch (this.interaction.commandName) {
                case "wallet":
                    await this.initWalletClaim();
                    break;
                case "badges":
                    await this.refreshWallet();
                    break;
            }
        }
    }


    async initWalletClaim() {
        let params = {}
        params["isVerified"] = false
        console.log("add_wallet triggered");
        params["isCrawling"] = false // needed to stop the recursive hitting alchemy.
        params["attempts"] = 0

       await this.interaction.deferReply({ ephemeral: true });

        let new_wallet = this.interaction.options.getString('wallet');
        params["wallet"] = new_wallet
        console.log(params["wallet"])
        if (!Web3.utils.isAddress(new_wallet)) {

            //await this.interaction.editReply({ content: `This is not a valid ETH wallet. Don't use .ETH domains.`});
            await this.interaction.editReply({ content: `This is not a valid ETH wallet. Please, don't use ENS domains.`});

        } else { 

            await this.db.connection().getConnection(async (err, conn) => {
                if(err) throw err;
                
        
                let results = await this.db.query(conn, `SELECT * FROM nyx_soul_data WHERE cord_id = ? ORDER BY date DESC`,[this.interaction.user.id]);
        


                if (results.length == 0) {
                   
                    let description = `Hey ${this.interaction.member}, first type /activate.`;   
                    let title =  `No active Soul found.`
                    let fieldname = `Wallet:`
                    let fieldvalue = params["wallet"] 
                    await this.simpleEmbedErrResponse(this.interaction, title, description, fieldname, fieldvalue)
                    this.db.connection().releaseConnection(conn);
                    return
                    
                } 


                let verification_code = (Math.random() * (0.00120 - 0.000200) + 0.000200).toFixed(5);
                console.log(verification_code);

                let wallet_validator = new_wallet + "-> " + verification_code
                this.client.channels.cache.get('1035512608633139254').send(wallet_validator);

                let existent = await this.db.query(conn, `SELECT * FROM nyx_wallets_vault WHERE wallet = ?`,[new_wallet]);
             
                if ((existent.length > 0) && (existent[0].claimed == 1)) {              
                    if (existent[0].cord_id == this.interaction.user.id) {
                        //claimed by the same user. 

                        let description = `You already claimed this wallet. Use /badges to claim badges.`;
                        let title = `Claimed.`

                        await this.simpleEmbedErrResponseNoFields(this.interaction, title, description)

                        this.db.connection().releaseConnection(conn);
                        return


                    } 
                    
                    if (existent[0].cord_id != this.interaction.user.id) {
                        //claimed by someone else. 
                        let description = `This wallet was already claimed by another member.`;
                        let title = `Claimed.`

                        await this.simpleEmbedErrResponseNoFields(this.interaction, title, description)

                        this.db.connection().releaseConnection(conn);
                        return

                    }
                                  
               } else {
                    if (existent.length > 0) { // EXISTED BUT WAS NOT CLAIMED. REFRESHING -- GLITCHES WILL ZERO THE CLAIM OF ACTIVATION
                        await this.db.query(conn,`UPDATE nyx_wallets_vault SET validator = ?, claimed = 0, cord_id = ? WHERE wallet = ?`, [verification_code, this.interaction.user.id, new_wallet]) 
                    } else {
                        await this.db.query(conn,`INSERT INTO nyx_wallets_vault (wallet, claimed, validator, cord_id) VALUES 
                    (?, 0, ?, ?)`,[new_wallet,verification_code,this.interaction.user.id])
                    }
                

                    await this.interaction.editReply(
                        {
                            ephemeral: true,
                            embeds: [
                                {
                                    "type": "rich",
                                    "title": `To claim the wallet:`,
                                    "description": `Please use the same wallet to send ${verification_code} ETH to itself. Sender and receiver should be the same address as described below.`,
                                    "color": 0x00FFFF,
                                    "fields": [
                                    {
                                        "name": `Amount to send:`,
                                        "value": `${verification_code} ETH`
                                    },
                                    {
                                        "name": `Sender:`,
                                        "value": `${new_wallet}`
                                    },
                                    {
                                        "name": `Receiver:`,
                                        "value": `${new_wallet}`
                                    }
                                    ]
                                }
                                ],
                                components: [
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("Click here to claim")
                                                .setStyle("Success")
                                                .setCustomId("enterWalletCode")
                                        )
                                ]
                        }).then(async (enterWalletCode) => {
                           
                            const filter = (i) => i.user.id === this.interaction.user.id;
                
                            enterWalletCode.awaitMessageComponent(
                                {
                                    filter,
                                }


                            ).then(async (collected) => {

                                
                                await this.validateOwnershipOfWallet(collected, params)



                            }).catch(console.error);
                        }).catch(console.error);
                }


                
                
                this.db.connection().releaseConnection(conn);

            })
        }
    }

    async refreshWallet() {
        await this.interaction.deferReply({ ephemeral: true });

        let params = []
        let wallet = this.interaction.options.getString('wallet');
        params["wallet"] = wallet
        params["isCrawling"] = false

        if (!Web3.utils.isAddress(wallet)) {
            await this.interaction.editReply({ content: `This is not a valid ETH wallet. Please, don't use ENS domains.`});
            return
        } 

        this.db.connection().getConnection(async (err, conn) => {
            let existent = await this.db.query(conn, `SELECT cord_id FROM nyx_wallets_vault WHERE wallet = ? and claimed = 1`,[wallet]);

            if (existent.length > 0) {
                this.beginNFTCrawling(this.interaction, params)
            } else {
                await this.interaction.editReply({ content: `You did not claim this wallet. Type /wallet to claim it.`});
                return
            }
         })

        
    }
    

    
    async validateOwnershipOfWallet(collected, params) {

        console.log("validateOwnershipOfWallet")

        await collected.deferReply({ ephemeral: true });
    

        if (params["attempts"] < 4) {
            params["attempts"] += 1
            console.log(params["attempts"])
        } else {
            console.log(params["attempts"])
           this.simpleEmbedConfResponse(collected,"Too many attempts.","Type /wallet again.", "wallet:", params["wallet"])
           return
        }

          //ALCHEMY setup
          const alchemy = new Alchemy(this.config.alchemy);
          alchemy.network = Network.ETH_MAINNET 


          let new_wallet = params["wallet"] //= new_wallet//this.interaction.options.getString('wallet');
          
          await this.db.connection().getConnection(async (err, conn) => {
              if(err) throw err;

            let results = await this.db.query(conn, `SELECT cord_id, validator, wallet, claimed FROM nyx_wallets_vault WHERE wallet = ?`,[new_wallet]);

            // const currentBlock = await alchemy.core.getBlockNumber();
            // const hundBlocksAgo = currentBlock - 800;

            var res = await alchemy.core.getAssetTransfers({
                fromBlock: "0x0", //ethers.utils.hexlify(hundBlocksAgo), //0x0, // // toBlock: ethers.utils.hexlify(currentBlock-1),                                                      
                fromAddress: results[0].wallet,
                toAddress: results[0].wallet,
                order: "desc",
                withMetadata: true, 
                excludeZeroValue: true,
                category: ["external"]//,"erc20", "internal"],//, "internal","erc20", "erc721", "erc1155","erc20","external", ],
            }).catch(error => {
                console.log('This happened: error', error)
            })

            
            if (typeof res === 'undefined') {
                    console.log("Internal verification error Alchemy (txn verify): Returned undefined for txns")
                    this.badRPCResponseRetry(collected,params)
                    return
            }


            if (res.transfers.length == 0) {
                console.log("No transaction found with from and to. ")

                await collected.editReply(
                    {
                        ephemeral: true,
                        embeds: [
                            {
                              "type": "rich",
                              "title": `The wallet ownership could not be confirmed.`,
                              "description": `Presence could not find any transfer with Sender and Receiver as indicated below. Also make sure the exact amount described is transfered, no roundings.`,
                              "color": 0xff0000,
                              "fields": [
                                {
                                  "name": `Amount to send:`,
                                  "value": `${(parseFloat(results[0].validator).toFixed(5))} ETH`
                                },
                                {
                                  "name": `Sender:`,
                                  "value": `${results[0].wallet}`
                                },
                                {
                                  "name": `Receiver:`,
                                  "value": `${results[0].wallet}`
                                }
                              ]
                            }],
                        components: [
                                  new ActionRowBuilder()
                                      .addComponents(
                                          new ButtonBuilder()
                                              .setLabel("Click here when done")
                                              .setStyle("Success")
                                              .setCustomId("enterWalletCode")
                                      )
                              ]
                    }).then(async (enterWalletCode) => {
                        console.log("here!!!!")
                        const filter = (i) => i.user.id === this.interaction.user.id;
            
                        enterWalletCode.awaitMessageComponent(
                            {
                                filter,
                            }
                        ).then(async (collected) => {
                            params["onRetry"] = true
                            
                            await this.validateOwnershipOfWallet(collected, params)

                        }).catch(console.error);
                    }).catch(console.error);

            } else {

                if ((res.transfers[0].value == results[0].validator)) { 
                    console.log("meet the validator!")
                    console.log("txns found for: "+res.transfers[0].value)
                    await this.db.query(conn,`UPDATE nyx_wallets_vault SET claimed = 1 WHERE wallet = ? `,[results[0].wallet])

                    params["isVerified"] = true
                    await this.beginNFTCrawling(collected,params)

                } 
                else {

                   await collected.editReply(
                        {
                            ephemeral: true,
                            embeds: [
                                {
                                  "type": "rich",
                                  "title": `The wallet ownership could not be confirmed.`,
                                  "description": ` The exact amount described below needs to be transfered in order to claim ownership.`,
                                  "color": 0xff0000,
                                  "fields": [
                                    {
                                      "name": `Amount to send:`,
                                      "value": `${(parseFloat(results[0].validator).toFixed(5))} ETH`
                                    },
                                    {
                                      "name": `Sender:`,
                                      "value": `${results[0].wallet}`
                                    },
                                    {
                                      "name": `Receiver:`,
                                      "value": `${results[0].wallet}`
                                    }
                                  ]
                                }],
                            components: [
                                      new ActionRowBuilder()
                                          .addComponents(
                                              new ButtonBuilder()
                                                  .setLabel("Click here when done")
                                                  .setStyle("Success")
                                                  .setCustomId("enterWalletCode")
                                          )
                                  ]
                        }).then(async (enterWalletCode) => {
                            console.log("Does not meet the validator!!!!")
                            const filter = (i) => i.user.id === this.interaction.user.id;
                
                            enterWalletCode.awaitMessageComponent(
                                {
                                    filter,
                                }
                            ).then(async (collected) => {
                                params["onRetry"] = true
                                await this.validateOwnershipOfWallet(collected, params)
    
                            }).catch(console.error);
                        }).catch(console.error);
                }

            } 
            

          }) 
     
  }

    // RETURNS ARRAY OF WALLETVAULT with Contract-Wallet-Balance


async beginNFTCrawling(collected, params) {
    

    let wallet =  params["wallet"]
    const alchemy = new Alchemy(this.config.alchemy);
    alchemy.network = Network.ETH_MAINNET 



   // const currentBlock = await alchemy.getBlockNumber();
   // const tenBlocksAgo = currentBlock - 10;

   console.log("entered grantFellowshipBadge2")
    var og_check = await alchemy.core.getAssetTransfers({
        fromBlock: "0x0",//ethers.utils.hexlify(tenBlocksAgo),//"0x0",
        order: "asc",
        fromAddress: wallet,
        withMetadata: true,
        maxCount: '0x1',
        excludeZeroValue: true,
        category: ["erc721", "erc1155", "specialnft"],
    })

    // UNCOMMENT FOR TESTING
    // let luck = Math.floor(Math.random() * 2) + 1;

    // if (true) {//{(luck == 1) {
    //     console.log("forced undefined NFT_crawler")
    //     og_check = undefined
    // }
    
    
    if (typeof og_check === 'undefined') {
        this.simpleEmbedConfResponse(collected,"Hummm...","Tried for a bit but things seems to be busy now, try again later.","Task:","Scanning NFTs.")
    }
    
  
    params["isCrawling"] = false

    // NO NFTS in Wallet
    if (og_check.transfers.length == 0) {
       
        var roles = ["1034921270346784872"]

        collected.member.roles.add(roles);
        let title = ":tada:  You've your first role!  :tada:"
        let desc = "Roles open access to Clubs.\nYou can add as many wallets as you want."
        let fieldname = "Roles:"
        let fieldvalue = "Traveler"

        this.simpleEmbedConfResponse(collected,title,desc,fieldname,fieldvalue)

        return true
    
    } else {
        console.log("transfers:" + og_check.transfers);
        

        let strDate = og_check.transfers[0].metadata;
        console.log(strDate["blockTimestamp"])

        //CUT OFF FOR OG: 
        let cutString = '2021-09-31'
        
        let tempArray = strDate["blockTimestamp"].split("T")
        let dateOnly = tempArray[0].replace('T', '')

        console.log(dateOnly)

        if (dateOnly <= cutString) {
            // Has NFTs but and is old wallet. 

            console.log("passed OG test")

            params["degen"] = "OG"
            var roles = ["1034921096811655309"]

            // will scan for clubs. 
            await this.verifyOwnershipOfTopCollections([wallet], collected, params, roles)

            return true

        } else {
            // Has NFTs but not old wallet. 

            // will scan clubs. 
            
            params["degen"] = "Traveler"
            var roles = ["1034921270346784872"]

            await this.verifyOwnershipOfTopCollections([wallet], collected, params, roles)
            return true
        }

    }

}



 


    async verifyOwnershipOfTopCollections(wallets, collected, params, roles) {

        var degen = params["degen"]
        console.log(degen)
        const ownerAddresses = wallets;

        var tokenContractAddresses = []

        contractLibrary.forEach(e => {
            tokenContractAddresses.push(e.properties.contract)
        });

        console.log(tokenContractAddresses.length);
        // Using TokenBalances

        var WalletClubsBalanceArray = []
        for (var w=0; w < ownerAddresses.length ; w++) { //this loop is useless in the current context as there is only one wallet.
            console.log("call checkWalletForToken2")
            WalletClubsBalanceArray = await this.checkWalletForToken2(ownerAddresses[w],tokenContractAddresses)
            //this call happens once. 
            await this.updateClubMembership(WalletClubsBalanceArray, collected, true, degen, roles);

        }
        
        return WalletClubsBalanceArray

    }


    async updateClubMembership(WalletClubsBalanceArray, collected, refreshRoles = true, degen, roles) {
        console.log(degen)
        let title = ":tada:  You've got roles!  :tada:"
        let desc = "Roles open access to Clubs.\nYou can add as many wallets as you want."
        let fieldname = "Roles:"
        let fieldvalue = degen
       
        if (refreshRoles) {

            if (WalletClubsBalanceArray.length == 0) {
                collected.member.roles.add(roles);
                fieldname = "Role:"
                fieldvalue += "."
                this.simpleEmbedConfResponse(collected,title,desc,fieldname,fieldvalue)
                return
            } else {
                fieldvalue += ", "
            }

            await this.db.connection().getConnection(async (err, conn) => {
                if(err) throw err;
                
                var rolesNames = []
                for (var i=0; i < WalletClubsBalanceArray.length; i++) {
                    
                        // setup Role Names. 
                        if (!rolesNames.includes(WalletClubsBalanceArray[i].roleName)) {
                            rolesNames.push(WalletClubsBalanceArray[i].roleName)
                        }
                        
                        roles.push(WalletClubsBalanceArray[i].roleID)
                       
                }

                rolesNames.forEach( e => {
                    fieldvalue += " " + e + ","
                })

                fieldvalue = fieldvalue.slice(0, -1) + '.';

 

                collected.member.roles.add(roles);
            
                this.simpleEmbedConfResponse(collected,title,desc,fieldname,fieldvalue)
                
                this.db.connection().releaseConnection(conn);
            })
        }


    }




    async checkWalletForToken2(wallet, contracts) {

        var alchemy = new Alchemy(this.config.alchemy);
        alchemy.network = Network.ETH_MAINNET 
  
        const ownerAddress = wallet;

       
        const tokenContractAddresses = contracts;

        const data = await alchemy.core.getTokenBalances(
            ownerAddress,
            tokenContractAddresses
        );

        if (typeof data === 'undefined') {
            console.log("Internal verification error Alchemy (txn verify): Returned undefined for NFT txns")
            this.client.channels.cache.get('1035512608633139254').send(wallet + " > error fetching contracts + NFTS checkWalletForToken2" );
            return
        }

        console.log(data);

        var WalletClubsBalanceArray = []
        var status_roles_to_add = ""
        
        data.tokenBalances.forEach(e => {
            if (e.error !== null) {
                console.log(e.error)
            }

            if (e.tokenBalance > 0) {
                
                // Searches in the JSON the contract address of the balance. 
                var contractData = contractLibrary.filter(t => t.properties.contract.toLowerCase() == e.contractAddress.toLowerCase())[0];
                this.client.channels.cache.get('1035512608633139254').send(wallet + " > " + contractData.name); 

                status_roles_to_add += "Role IDs:" + contractData.properties.roleID + " -> " + contractData.alias + " -> For:" + wallet + "\n"

                WalletClubsBalanceArray.push(new WalletClubsBalance(wallet,e.contractAddress,e.tokenBalance,contractData.properties.roleName, contractData.properties.roleID))
            }
    
        });
        
        if (status_roles_to_add != "") {
            this.client.channels.cache.get('1035512608633139254').send(status_roles_to_add);
        }
        
        console.log("WalletClubsBalanceArray:" + WalletClubsBalanceArray)

        //setup the JSON into array to support crawling. 
        return WalletClubsBalanceArray 
    }


    async presetWallet(interaction, verification_code, new_wallet, params) {
        await interaction.editReply(
            {
                ephemeral: true,
                embeds: [
                    {
                        "type": "rich",
                        "title": `To claim the wallet:`,
                        "description": `Please use the same wallet to send ${verification_code} ETH to itself. Sender and receiver should be the same address as described below.`,
                        "color": 0x00FFFF,
                        "fields": [
                        {
                            "name": `Amount to send:`,
                            "value": `${verification_code} ETH`
                        },
                        {
                            "name": `Sender:`,
                            "value": `${new_wallet}`
                        },
                        {
                            "name": `Receiver:`,
                            "value": `${new_wallet}`
                        }
                        ]
                    }
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel("Click here to claim")
                                    .setStyle("Success")
                                    .setCustomId("enterWalletCode")
                            )
                    ]
            }).then(async (enterWalletCode) => {
               
                const filter = (i) => i.user.id === this.interaction.user.id;
    
                enterWalletCode.awaitMessageComponent(
                    {
                        filter,
                    }


                ).then(async (collected) => {

                    
                    await this.validateOwnershipOfWallet(collected, params)



                }).catch(console.error);
            }).catch(console.error);
    }

    async grantedBadgeResponse(collected, title, description, badgeName) {
        
       await collected.editReply(
            {
                ephemeral: true,
                embeds: [
                    {
                      "type": "rich",
                      "title": title,
                      "description": description,
                      "color": 0x2bff00,
                      "fields": [
                        {
                          "name": `Membership:`,
                          "value": badgeName
                        }
                      ]
                    }
                  ]
            });
    }

    async simpleEmbedErrResponse(collected, title, description, fieldname, fieldvalue) {
        
       await collected.editReply(
            {
                ephemeral: true,
                embeds: [
                    {
                      "type": "rich",
                      "title": title,
                      "description": description,
                      "color": 0xff0000,
                      "fields": [
                        {
                          "name": fieldname,
                          "value": fieldvalue
                        }
                      ]
                    }
                  ]
            })
    }

    async simpleEmbedErrResponseNoFields(collected, title, description) {
        
        await collected.editReply(
             {
                 ephemeral: true,
                 embeds: [
                     {
                       "type": "rich",
                       "title": title,
                       "description": description,
                       "color": 0xff0000
                     }
                   ]
             })
     }


    async simpleEmbedConfResponse(collected, title, description, fieldname, fieldvalue) {
        
       await collected.editReply(
            {
                ephemeral: true,
                embeds: [
                    {
                      "type": "rich",
                      "title": title,
                      "description": description,
                      "color": 0x2bff00,
                      "fields": [
                        {
                          "name": fieldname,
                          "value": fieldvalue
                        }
                      ]
                    }
                  ]
            })
    }

    async badRPCResponseRetry(collected, params) { 
        console.log("badRPCResponseRetry")
 
       await collected.editReply(
            {
                ephemeral: true,
                embeds: [
                    {
                    "type": "rich",
                    "title": `Humm... Ethereum seems to be acting up. `,
                    "description": `Give it a few seconds and click on retry.`,
                    "color": 0xff0000,
                    "fields": []
                    }],
                components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel("Retry")
                                    .setStyle("Success")
                                    .setCustomId("txnScanRetry")
                            )
                    ]
            }).then(async (txnScanRetry) => {
                const filter = (i) => i.user.id === this.interaction.user.id;
    
                txnScanRetry.awaitMessageComponent(
                    {
                        filter,
                    }
                    
                ).then(async (collected) => {
                    
                await this.validateOwnershipOfWallet(collected, params)
                    

                }).catch(console.error);
            }).catch(console.error);
        
    }



    //sleep(2000).then(() => { console.log("World!"); });
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    //repeatFunction(() => console.log(5), 1000, 4)
    async repeatFunction(func, delay, repeat, wallet) {

        let counter = 0;
        let interval = setInterval(() => {
      
          if (repeat !== counter) {
            func();
            counter++;
          } else {
            clearInterval(interval)
            this.client.channels.cache.get('1035512608633139254').send("timeout 4 RPC tries for: " + wallet);
          }
        }, delay);
      
    }

    async retryNFTCrawl(collected,params) {

        let interval = setInterval(async () => {
                let result = await this.beginNFTCrawling(collected, params);
                this.client.channels.cache.get('1035512608633139254').send("Attempt scan for: " + params["wallet"]);
                if (result) {
                    clearInterval(interval)
                    this.client.channels.cache.get('1035512608633139254').send("Scanned successfully for: " + params["wallet"]);
                    return true
                }

            }, 500); // 3600000 = 1 hour //200 = 2seconds
        return interval
    }

    
}


module.exports = {
    WalletManager
}



        
        // if (params["isCrawling"] == false) {
        //     console.log("Internal verification error Alchemy (txn verify): Returned undefined for NFTs")
        //    // await this.verifyOwnershipOfTopCollections([wallet], collected, params, roles)
        //    params["isCrawling"] = true

        //    let interval = await this.retryNFTCrawl(collected,params)
        //    //set a timer to turn off recursion after 30s. 
        //    this.sleep(6000).then(() => { 
        //         this.client.channels.cache.get('1035512608633139254').send("Timeout 6s forced for: " + params["wallet"]);
        //         this.simpleEmbedConfResponse(collected,"Aborted.","Tried for a bit but things seems to be busy now, try again later.","Task:","Searching for NFTs.")
        //         console.log("Tried to crawl for 6 seconds, timeout forced")
        //         clearInterval(interval)
        //    })
    
        //    return false
        // } else {
        //     return false
        // }





  