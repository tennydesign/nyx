//ActivationManager.js//

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle  } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders")
const { Database } = require("../database/Database.js");
const { ModuleManager } = require("./ModuleManager");
const { Network, Alchemy } = require('alchemy-sdk');
const contractLibrary = require("../config/contractsLibrary.json");
const Web3 = require("web3")
const {ethers} = require('ethers');
const needle = require('needle');
const {use} = require("needle/lib/parsers");
const Cooldown = new Set();

class ActivationManager {
    constructor(interaction, client, config) {
        this.interaction = interaction;
        this.client = client;
        this.config = config;

        if (interaction !== null) {
            this.db = new Database(config);
        }
    }

    loadCommands() {
        return [
            new SlashCommandBuilder()
                .setName("activate")
                .setDescription("Activate your Soul."),
        ]
    }

    async on() {
        if(this.interaction.isChatInputCommand()) {
            switch (this.interaction.commandName) {
                case "activate":
                    await this.initActivation();
                    break;
            }
        }
    }

    initActivation() {
        let params = {
            wallet: null,
            twitter: null,
            twitter_name: null,
            twitterCode: null,
            verification_amount: null
        };

        Cooldown.add(this.interaction.user.id);

        this.db.connection().getConnection(async (err, conn) => {
            if(err) throw err;

            let Surveys = await this.db.query(conn, `SELECT * FROM nyx_soul_data`);

            if(Surveys.some(fn => fn.cord_id === this.interaction.user.id)) {
                if ((Surveys.find(fn => fn.cord_id === this.interaction.user.id).wallet === null) &&
                    (Surveys.find(fn => fn.cord_id === this.interaction.user.id).twitter_id === null)) {
                    await this.proceedToInitiation(conn, params);
                } else if (Surveys.find(fn => fn.cord_id === this.interaction.user.id).twitter_id === null) {
                    await this.interaction.reply(
                        {
                            ephemeral: true,
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("Twitter proof of ownership.")
                                    .setDescription(`> Verify your twitter, no @. **!! Make sure you follow @nyxsoul_ai. !!**`)
                                    .setColor("Blue")
                                    .setTimestamp()
                                    .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            ]
                        }
                    ).then().catch(console.error);
                    
                    await this.collectTwitter(conn, params, this.interaction);
                } else {
                    await this.interaction.reply(
                        {
                            ephemeral: true,
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("You are already activated.")
                                    .setDescription(`> You can  /wallet to add new wallets and claim badges.`)
                                    .setColor("Blue")
                                    .setTimestamp()
                                    .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            ]
                        }
                    ).then().catch(console.error);
                }
            } else {
                await this.proceedToInitiation(conn, params, this.interaction);
            }

            this.db.connection().releaseConnection(conn);
        })
    }

    async proceedToInitiation(conn, params) {
        await this.interaction.reply(
            {
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Claim a wallet")
                        .setDescription(`> Hit input, type your wallet (no ENS), and make the self transfer as described.`)
                        .setColor("Blue")
                        .setTimestamp()
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Input")
                                .setStyle("Primary")
                                .setCustomId("input_address")
                        )
                ]
            }
        ).then().catch(console.error);

        await this.collectWallet(conn, params);
    }

    async collectWallet(conn, params) {
        for(let i = 0; 3 > i; i++) {
            const filter = (i) => i.customId === "input_address" && i.user.id === this.interaction.user.id;
            await new Promise(async (resolve) => {
                await this.interaction.channel.awaitMessageComponent({filter, time: 1200000}).then(
                    async (collected) => {
                        console.log(collected.id)

                        const modal = new ModalBuilder()
                            .setCustomId(`walletAddress`)
                            .setTitle("Wallet Activation")

                        const address = new TextInputBuilder()
                            .setCustomId("address")
                            .setLabel("What's your wallet address?")
                            .setStyle(TextInputStyle.Short)

                        const firstAction = new ActionRowBuilder().addComponents(address)

                        modal.addComponents(firstAction)

                        await collected.showModal(modal).then().catch(console.error);

                        const filter = (interaction) => interaction.customId === 'walletAddress';

                        await collected.awaitModalSubmit({filter, time: 120000}).then(async (modal) => {
                            await modal.deferUpdate().then().catch(console.error);

                            params.wallet = modal.fields.getTextInputValue("address");

                            if (Web3.utils.isAddress(params.wallet)) {
                                let SurveyData = await this.db.query(conn, `SELECT * FROM nyx_soul_data`);

                                if(!SurveyData.some(fn => fn.wallet === params.wallet)) {
                                    i=99;
                                    await this.walletVerification(conn, params, collected);
                                    resolve();
                                } else {
                                    await collected.editReply(
                                        {
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Claim a wallet")
                                                    .setDescription(`> The address you typed has already been claimed.`)
                                                    .setColor("Orange")
                                                    .setTimestamp()
                                                    .setFooter({
                                                        text: this.interaction.guild.name,
                                                        iconURL: this.interaction.guild.iconURL()
                                                    })
                                            ],
                                            components: [
                                                new ActionRowBuilder()
                                                    .addComponents(
                                                        new ButtonBuilder()
                                                            .setLabel("Input Again")
                                                            .setStyle("Primary")
                                                            .setCustomId("input_address")
                                                    )
                                            ]
                                        }
                                    ).then().catch(console.error);
                                    resolve();
                                }
                            } else {
                                if(i === 2) {
                                    await collected.editReply(
                                        {
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Claim a wallet")
                                                    .setDescription(`> **Follow the instructions to send ETH to yourself**. Too many attempts.`)
                                                    .setColor("Red")
                                                    .setTimestamp()
                                                    .setFooter({
                                                        text: this.interaction.guild.name,
                                                        iconURL: this.interaction.guild.iconURL()
                                                    })
                                            ],
                                            components: []
                                        }
                                    ).then().catch(console.error);
                                } else{
                                    await collected.editReply(
                                        {
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Claim a wallet")
                                                    .setDescription(`> The address you typed is not a valid ETH wallet. Please, don't use ENS domains.`)
                                                    .setColor("Orange")
                                                    .setTimestamp()
                                                    .setFooter({
                                                        text: this.interaction.guild.name,
                                                        iconURL: this.interaction.guild.iconURL()
                                                    })
                                            ],
                                            components: [
                                                new ActionRowBuilder()
                                                    .addComponents(
                                                        new ButtonBuilder()
                                                            .setLabel("Input Again")
                                                            .setStyle("Primary")
                                                            .setCustomId("input_address")
                                                    )
                                            ]
                                        }
                                    ).then().catch(console.error);
                                }
                            }
                            resolve();
                        }).catch(console.error);
                    }
                ).catch(
                    async () => {
                        i=99;
                        await this.handleProcessError(this.interaction, "You took to long to input your wallet address. Please try again.");
                        return resolve();
                    }
                );
            });
        }
    }

    async walletVerification(conn, params, collected) {
  

        const alchemy = new Alchemy(this.config.alchemy);
        alchemy.network = Network.ETH_MAINNET 

     
        let embed = [
            new EmbedBuilder()
                .setTitle("Claim your wallet")
                .setColor("Blue")
                .setDescription(`Please use the same wallet to send ETH to itself. Sender and receiver should be the same address as described below.`)
                .setFields(
                    {
                        name: "Amount to send:",
                        value: `d`,
                        inline: false
                    },
                    {
                        name: "Sender:",
                        value: `${"`" + params.wallet + "`"}`,
                        inline: false
                    },
                    {
                        name: "Receiver:",
                        value: `${"`" + params.wallet + "`"}`,
                        inline: false
                    },
                )
                .setFooter({
                    text: this.interaction.guild.name,
                    iconURL: this.interaction.guild.iconURL()
                })
        ];

        for(let i = 0; 3 > i; i++) {
            await new Promise(async (resolve) => {
                this.db.connection().getConnection(async (err, conn) => {
                    if (err) throw err;

                    let Profiles = await this.db.query(conn, `SELECT * FROM nyx_soul_data`);

                    if (!Profiles.some(fn => fn.wallet_address === params.wallet)) {
                        
                        var verification_amount = null
                        if (params["verification_amount"] === null) {
                            verification_amount = (Math.random() * (0.00120 - 0.000200) + 0.000200).toFixed(5);
                            params["verification_amount"] = verification_amount
                        } else {
                            verification_amount = params["verification_amount"]
                        }

                        //embed[0].data.fields[0].value = `${verification_amount} ETH`
                        embed[0].data.fields[0].value = `${verification_amount} ETH`

                        embed[0].data.description = "**INSTRUCTIONS**: Use the same wallet to send ETH to itself. Sender and receiver should be the same address as described below"

                        await collected.editReply(
                            {
                                embeds: [
                                    embed[0]
                                ],
                                components: [
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("Click here to claim")
                                                .setCustomId("claim_wallet")
                                                .setStyle("Success")
                                        )
                                ]
                            }
                        ).then().catch(console.error);

                        const filter = (i) => i.customId === "claim_wallet" && i.user.id === this.interaction.user.id;

                        await this.interaction.channel.awaitMessageComponent({filter, time: 1200000}).then(
                            async (collected) => {
                                await collected.deferUpdate().then().catch(console.error);

                                let res = await alchemy.core.getAssetTransfers({
                                    fromBlock: "0x0", //ethers.utils.hexlify(hundBlocksAgo), //0x0, // // toBlock: ethers.utils.hexlify(currentBlock-1),
                                    fromAddress: params.wallet,
                                    toAddress: params.wallet,
                                    order: "desc",
                                    withMetadata: true,
                                    excludeZeroValue: true,
                                    category: ["external"]//,"erc20", "internal"],//, "internal","erc20", "erc721", "erc1155","erc20","external", ],
                                }).catch(error => {
                                    console.log('This happened: error', error)
                                });
                                
                                console.log(res)
                                //if ((res.transfers[0].value == parseInt(verification_amount))) { 


                                if (typeof res === 'undefined') {
                                        console.log("Internal verification error Alchemy (txn verify): Returned undefined for txns")
                                        await this.handleProcessError(collected, `I had a problem scanning this wallet. Please open a ticket.`)
                                        i=99;
                                        resolve();  
                                }

                                // if (res.transfers.length == 0) {
                                //     console.log("no transaction found.")
                                //     await this.handleProcessError(collected, `Could not find any transactions for the wallet.`)
                                //     i=99;
                                //     resolve();                                      
                                // }

                                //console.log(res.transfers[0].value + ": " + verification_amount)
                                if (res.transfers.some(fn => fn.value == verification_amount)) {//res.transfers.some(fn => fn.value === verification_amount)) {
                                    await collected.editReply(
                                        {
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Wallet Claimed")
                                                    .setDescription("You've successfully claimed your wallet. Now to proceed to the twitter verification, click continue.")
                                                    .setColor("Green")
                                                    .setTimestamp()
                                                    .setFooter({
                                                        text: this.interaction.guild.name,
                                                        iconURL: this.interaction.guild.iconURL()
                                                    })
                                            ],
                                            components: [
                                                new ActionRowBuilder()
                                                    .addComponents(
                                                        new ButtonBuilder()
                                                            .setLabel("Continue")
                                                            .setStyle("Primary")
                                                            .setCustomId("continue_twitter")
                                                    )
                                            ]
                                        }
                                    ).then().catch(console.error);

                                    let Surveys = await this.db.query(conn, `SELECT * FROM nyx_soul_data`);

                                    let sql;
                                    if(Surveys.some(fn => fn.cord_id === this.interaction.user.id)) {
                                        sql = `UPDATE nyx_soul_data SET wallet = "${params.wallet}" WHERE cord_id = "${this.interaction.user.id}"`;
                                    } else {
                                        sql =`INSERT INTO nyx_soul_data (cord_id, wallet) VALUES ("${this.interaction.user.id}", "${params.wallet}")`;
                                    }
                                    await this.db.query(conn, sql);

                                    // UPDATE WALLETS_VAULT
                                    await this.db.query(conn,`INSERT INTO nyx_wallets_vault (cord_id, wallet, claimed, validator) VALUES 
                                    (?, ?, 1, ?)
                                        ON DUPLICATE KEY UPDATE cord_id = ?, wallet = wallet, claimed = 1, validator = ?`,
                                     [this.interaction.user.id, params.wallet, verification_amount, this.interaction.user.id, verification_amount])
                                     

                                    await this.collectTwitter(conn, params, collected);

                                    i=99;
                                    resolve();
                                } else {
                                    if(i === 2) {
                                        await collected.editReply(
                                            {
                                                embeds: [
                                                    new EmbedBuilder()
                                                        .setTitle("Claim a wallet")
                                                        .setDescription(`> You didn't make the transfer. Please /activate again and make the transfer as described.`)
                                                        .setColor("Red")
                                                        .setTimestamp()
                                                        .setFooter({
                                                            text: this.interaction.guild.name,
                                                            iconURL: this.interaction.guild.iconURL()
                                                        })
                                                ],
                                                components: []
                                            }
                                        ).then().catch(console.error);
                                        resolve();
                                    } else {
                                        embed[0].data.color = 15105570; // Orange
                                        resolve();
                                    }
                                }
                            }
                        ).catch(
                            async (err) => {
                                console.log(err)
                                await this.handleProcessError(collected, `You took too long to claim your wallet. Try again.`)
                                i=99;
                                resolve();
                            }
                        );
                    } else {
                        await this.handleProcessError(collected, `There's already someone which has claimed this wallet. Please try again.`)
                        i=99;
                        resolve();
                    }

                    this.db.connection().releaseConnection(conn);
                });
            });
        }
    }

    async collectTwitter(conn, params, collected) {
        let msg = [
            {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Claim a Twitter")
                        .setDescription(`> Enter your twitter username, no @.`)
                        .setColor("Blue")
                        .setTimestamp()
                        .setFooter({
                            text: this.interaction.guild.name,
                            iconURL: this.interaction.guild.iconURL()
                        })
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Input")
                                .setStyle("Primary")
                                .setCustomId("input_twitter")
                        )
                ]
            }
        ];

        for(let i = 0; 3 > i; i++) {
            await collected.editReply(
                msg[0]
            ).then().catch(console.error);

            const filter = (i) => i.customId === "input_twitter" && i.user.id === this.interaction.user.id;

            await new Promise(async (resolve) => {
                await this.interaction.channel.awaitMessageComponent({filter, time: 1200000}).then(
                    async (collected) => {

                        const modal = new ModalBuilder()
                            .setCustomId(`twitterAccount`)
                            .setTitle("Twitter Verification")

                        const address = new TextInputBuilder()
                            .setCustomId("screenName")
                            .setLabel("What's the twitter username?")
                            .setStyle(TextInputStyle.Short)

                        const firstAction = new ActionRowBuilder().addComponents(address)

                        modal.addComponents(firstAction)

                        await collected.showModal(modal).then().catch(console.error);

                        const filter = (interaction) => interaction.customId === 'twitterAccount';

                        await collected.awaitModalSubmit({filter, time: 120000}).then(async (modal) => {
                            await modal.deferUpdate().then().catch(console.error);

                            params.twitter = modal.fields.getTextInputValue("screenName");

                            let Surveys = await this.db.query(conn, `SELECT * FROM nyx_soul_data`);

                            if(!Surveys.some(fn => fn.twitter_name === params.twitter)) {
                                let User = await needle(
                                    "get",
                                    `https://api.twitter.com/2/users/by/username/${params.twitter}?user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,url,username,verified,withheld,public_metrics`,
                                    {
                                        headers: {
                                            authorization: `Bearer ${this.config.twitter.bearer_token}`
                                        }
                                    }
                                );

                                if(typeof User.body.errors === 'undefined') {
                                    if (User.body.title !== "Invalid Request" || typeof User.body.data !== 'undefined') {
                                        let fields = [];

                                       // console.log(User.body.data.description)
                                        if((typeof User.body.data.description !== 'undefined') && User.body.data.description != "") {
                                            fields.push(
                                                {
                                                    name: "Bio",
                                                    value: `${User.body.data.description}`,
                                                    inline: true
                                                }
                                            )
                                        };
                                      //  console.log(User.body.data.location)
                                        if((typeof User.body.data.location !== 'undefined') && User.body.data.location != "") {
                                            fields.push(
                                                {
                                                    name: "Location",
                                                    value: `${User.body.data.location}`,
                                                    inline: true
                                                }
                                            );
                                        }

                                        if(fields.length === 2) {
                                            fields.push(
                                                { name: '\u200B', value: '\u200B', inline: true },
                                            )
                                        }

                                        fields.push(
                                            {
                                                name: "Followers",
                                                value: `${User.body.data.public_metrics.followers_count}`,
                                                inline: true,
                                            },
                                            {
                                                name: "Following",
                                                value: `${User.body.data.public_metrics.following_count}`,
                                                inline: true,
                                            },
                                            { name: '\u200B', value: '\u200B', inline: true },
                                        );
                                      
            
                                        await collected.editReply(
                                            {
                                                embeds: [
                                                    new EmbedBuilder()
                                                        .setAuthor({name: `${User.body.data.username} | ${User.body.data.name}`})
                                                        .setColor("Blue")
                                                        .addFields(
                                                            fields
                                                        )
                                                        .setThumbnail((User.body.data.profile_image_url).replace("_normal",""))
                                                        .setTimestamp()
                                                        .setFooter({
                                                            text: this.interaction.guild.name,
                                                            iconURL: this.interaction.guild.iconURL()
                                                        })
                                                ],
                                                components: [
                                                    new ActionRowBuilder()
                                                        .addComponents(
                                                            new ButtonBuilder()
                                                                .setLabel("It's Me")
                                                                .setStyle("Success")
                                                                .setCustomId("confirm")
                                                        )
                                                        .addComponents(
                                                            new ButtonBuilder()
                                                                .setLabel("It's Not Me")
                                                                .setStyle("Danger")
                                                                .setCustomId("deny")
                                                        )
                                                ]
                                            }
                                        ).then().catch(console.error);

                                        const filter = (i) => i.user.id === this.interaction.user.id;

                                        await this.interaction.channel.awaitMessageComponent({filter, time: 1200000}).then(
                                            async (collected) => {
                                                await collected.deferUpdate().then().catch(console.error);

                                                switch (collected.customId) {
                                                    case "confirm":
                                                        params.twitter = User.body.data.id;
                                                        params.twitter_name = User.body.data.username;

                                                        await this.twitterVerification(conn, params, collected);
                                                        resolve();
                                                        i=99;
                                                        break;
                                                    case "deny":
                                                        msg[0].components[0].data.label = "Try Again";
                                                        msg[0].embeds[0].data.color = 15105570;
                                                        resolve();
                                                        break;
                                                }
                                            }
                                        ).catch(
                                            async (err) => {
                                                i=99;
                                                await this.handleProcessError(this.interaction, "You took to long to input your twitter username. Please try again.");
                                                resolve();
                                            }
                                        )
                                    } else {
                                        msg[0].components[0].data.label = "Try Again";
                                        msg[0].embeds[0].data.color = 15105570;

                                        resolve();
                                    }
                                } else {
                                    msg[0].components[0].data.label = "Try Again";
                                    msg[0].embeds[0].data.color = 15105570;

                                    resolve();
                                }
                            } else {
                                msg[0].components[0].data.label = "Try Again";
                                msg[0].embeds[0].data.color = 15105570;
                                msg[0].embeds[0].data.description = "This twitter have already been claimed. Try again."

                                resolve();
                            }
                        }).catch(console.error);
                    }
                ).catch(
                    async () => {
                        i=99;
                        await this.handleProcessError(this.interaction, "You took to long to input your twitter username. Please try again.");
                        resolve();
                    }
                );
            });
        }
    }

    async twitterVerification(conn, params, collected) {
        let codeChannel = await this.interaction.guild.channels.cache.get("1032300242386829352");
        let code = (Math.random() * (1000 - 10000) + 10000).toFixed(0);
        params.twitterCode = code;

        await codeChannel.send(`${params.twitter},${this.interaction.user.id},${code}`).then().catch(console.error);

        let msg = {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Claim your twitter")
                    .setDescription("A verification will be sent to you in private. Once received please hit input and type the code.")
                    .setColor("Blue")
                    .setTimestamp()
                    .setFooter({
                        text: this.interaction.guild.name,
                        iconURL: this.interaction.guild.iconURL()
                    })
            ],
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel("Input")
                            .setStyle("Primary")
                            .setCustomId("input_twitter_code")
                    )
            ]
        }

        for(let i = 0; 3 > i; i++) {
            await new Promise(async (resolve) => {
                await collected.editReply(
                    msg
                ).then().catch(console.error);

                const filter = (i) => i.user.id === this.interaction.user.id && i.customId === "input_twitter_code";

                await this.interaction.channel.awaitMessageComponent({filter, time: 1200000}).then(
                    async (collected) => {
                        const modal = new ModalBuilder()
                            .setCustomId(`twitterCode`)
                            .setTitle("Twitter Verification")

                        const address = new TextInputBuilder()
                            .setCustomId("code")
                            .setLabel("What's verification code you've received?")
                            .setStyle(TextInputStyle.Short)

                        const firstAction = new ActionRowBuilder().addComponents(address)

                        modal.addComponents(firstAction)

                        await collected.showModal(modal).then().catch(console.error);

                        const filter = (interaction) => interaction.customId === 'twitterCode';

                        await collected.awaitModalSubmit({filter, time: 120000}).then(
                            async (modal) => {
                                await modal.deferUpdate().then().catch(console.error);
                                let typedCode = modal.fields.getTextInputValue("code");

                                if(parseInt(params.twitterCode) === parseInt(typedCode)) {
                                    let Surveys = await this.db.query(conn, `SELECT * FROM nyx_soul_data`);

                                    let sql;
                                    if(Surveys.some(fn => fn.cord_id === this.interaction.user.id)) {
                                        sql = `UPDATE nyx_soul_data SET twitter_id = "${params.twitter}", twitter_name = "${params.twitter_name}" WHERE cord_id = "${this.interaction.user.id}"`;
                                    } else {
                                        sql =`INSERT INTO nyx_soul_data (cord_id, wallet, twitter_id, twitter_name) VALUES ("${this.interaction.user.id}", "${params.wallet}", ${params.twitter}", "${params.twitter_name}")`;
                                    }
                                    await this.db.query(conn, sql);

                                    await this.verificationEnding(conn, params, collected);

                                    // var roles = ["1032081077533151264"] Soulbind moved to individuation.
                                    // collected.member.roles.add(roles);

                                    i=99;
                                    resolve();

                                } else {
                                    msg.components[0].data.label = "Try Again";
                                    msg.embeds[0].data.color = 15105570;
                                    msg.embeds[0].data.description = "The verification code you typed is incorrect. Please type the code you've received in dm. To do so hit the 'Try Again' button."

                                    resolve();
                                }
                            }
                        ).catch(
                            async (err) => {
                                i=99;
                                await this.handleProcessError(this.interaction, "You took to long to input your twitter username. Please try again.");
                                resolve();
                            }
                        );
                    }
                ).catch(
                    async (err) => {
                        i=99;
                        await this.handleProcessError(this.interaction, "You took to long to input your twitter username. Please try again.");
                        resolve();
                    }
                )
            });
        }
    }

    async verificationEnding(conn, params, collected) {
        
        if(params.wallet === null) {
            let Survey = await this.db.query(conn, `SELECT * FROM nyx_soul_data WHERE cord_id = "${this.interaction.user.id}"`);
            
            params.wallet = Survey[0].wallet;
        }
        

        await collected.editReply(
            {
                embeds: [
                    new EmbedBuilder()
                        .setColor("Green")
                        .setTitle("Verification Finished")
                        .setDescription(`Hey ${this.interaction.member}, you've successfully finished the verification! Head to <#1029425182286299156> to individuate.\nHere's a recap:`)
                        .addFields(
                            {
                                name: "Claimed Wallet",
                                value: `${"`" + params.wallet + "`"}`,
                                inline: false
                            },
                            {
                                name: "Claimed Twitter",
                                value: `@${params.twitter_name}`,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({
                            text: this.interaction.guild.name,
                            iconURL: this.interaction.guild.iconURL()
                        })
                ],
                components: []
            }
        ).then().catch(console.error);
    }

    async handleProcessError(interaction, msg) {
        Cooldown.delete(this.interaction.user.id);

        await interaction.editReply(
            {
                embeds: [
                    new EmbedBuilder()
                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                        .setTimestamp()
                        .setDescription("> " + msg)
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                        .setColor("Red")
                ]
            }
        ).then().catch(console.error);
    }
}

module.exports = {
    ActivationManager
}