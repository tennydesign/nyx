//SurveyManager.js// 

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle  } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders")
const { Database } = require("../database/Database.js");
const { ModuleManager } = require("./ModuleManager");
const needle = require('needle');
const {Alchemy, Network} = require("alchemy-sdk");

class SurveyManager {
    constructor(interaction = null, client = null, config = null) {
        this.interaction = interaction;
        this.client = client;
        this.config = config;

        if (interaction !== null) {
            this.mm = new ModuleManager(client, config);
            this.db = new Database(config);
        }
    }

    loadCommands() {
        return [
            new SlashCommandBuilder()
                .setName("setup-survey")
                .setDescription("setup a survey message box."),
        ]
    }

    loadTables() {
        return [
           // `CREATE TABLE IF NOT EXISTS dc_survey_users (id INT NOT NULL PRIMARY KEY AUTO_INCREMENT, cord_id VARCHAR(30), status VARCHAR(30))`,
            `CREATE TABLE IF NOT EXISTS nyx_soul_data (cord_id VARCHAR(30), twitter_id VARCHAR(30), twitter_name VARCHAR(30), main_driver VARCHAR(30), archetype VARCHAR(30), wallet VARCHAR(100), soul_id BIGINT, soul_1 VARCHAR(30), soul_2 VARCHAR(30), soul_3 VARCHAR(30), soul_4 VARCHAR(30), soul_5 VARCHAR(30), soul_6 VARCHAR(30), soul_7 VARCHAR(30), soul_8 VARCHAR(30), soul_9 VARCHAR(30), soul_10 VARCHAR(30), soul_11 VARCHAR(30), soul_12 VARCHAR(30), date TIMESTAMP)`
        ]
    }

    async on() {
        if(this.interaction.isChatInputCommand()) {
            switch (this.interaction.commandName) {
                case "setup-survey":
                    await this.setupSurvey();
                    break;
            }
        } else if(this.interaction.isButton()) {
            switch (this.interaction.customId) {
                case "StartSurvey":
                    await this.initializeSurveyFromButton();
            }
        }
    }

    async setupSurvey() {
        if(this.interaction.member.permissions.has("Administrator")) {
            await this.interaction.reply(
                {
                    ephemeral: false,
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Green")
                            .setTitle("Soul Individuation")
                            .setDescription(`Only you will be able to see and answer the questions. Click on the start button whenever you're ready.`)
                            .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                            .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            .setTimestamp()
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel("Start")
                                    .setStyle("Success")
                                    .setCustomId("StartSurvey")
                            )
                    ]
                }
            ).then().catch(console.error);
        } else {
            await this.interaction.reply(
                {
                    ephemeral: true,
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setDescription(`Hey ${this.interaction.user}, You are not allowed to use this command.`)
                            .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                            .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            .setTimestamp()
                    ]
                }
            ).then().catch(console.error);
        }
    }

    async initializeSurveyFromButton() {
        this.db.connection().getConnection(async (err, conn) => {
            if(err) throw err;

            // let SurveysUsers = await this.db.query(conn, `SELECT * FROM dc_survey_users WHERE cord_id = "${this.interaction.user.id}"`);

            // FUTURE: WHEN BOT INDIVIDUATION: 
            // ASK WHICH Soul
            // CHECK IF THERE IS A Soul IN ANY OF THE USER WALLETs THAT MATCHES THE ID INFORMED. 
            // IF IT DOES, CONTINUES. 
            // IF NOT, TELL THE USER TO EITHER INDIVIDUATE VIA WEB OR ADD THE WALLET THAT HAS A Soul. 


            //turn off uniqueness. 

            let params = {};
            await this.interaction.reply(
                {
                    ephemeral: true,
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Blue")
                            .setTitle("Soul Individuation")
                            .setDescription(`Hey ${this.interaction.user}, welcome to the Individuation process. This process will reveal your Soul. Press start to begin.`)
                            .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                            .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            .setTimestamp()
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel("Start")
                                    .setStyle("Success")
                                    .setCustomId("start")
                            )
                    ]
                }
            ).then().catch(console.error);

            const filter = i => i.customId === 'start' && i.user.id === this.interaction.user.id;

            const collector = this.interaction.channel.createMessageComponentCollector({ filter, time: 600000 });

            collector.on('collect', async (interaction) => {
                console.log("collected for" + this.interaction.user.id);
                await interaction.deferUpdate().then().catch(console.error);
                await this.question1(conn, interaction, params);
            });

            collector.on('end', (collected) => {

            });


            this.db.connection().releaseConnection(conn);
        });
    }

    async startSurvey(conn) {
        let params = {};
        await this.interaction.reply(
            {
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setColor("Blue")
                        .setTitle("Soul Individuation")
                        .setDescription(`Hey ${this.interaction.user}, click on the start button whenever you're ready.`)
                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                        .setTimestamp()
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Start")
                                .setStyle("Success")
                                .setCustomId("startSurvey")
                        )
                ]
            }
        ).then(async (startSurvey) => {
            const filter = (i) => i.user.id === this.interaction.user.id;

            startSurvey.awaitMessageComponent(
                {
                    filter,
                }
            ).then(async (collected) => {
                await this.question1(conn, collected, params);
            }).catch(console.error);
        }).catch(console.error);
    }

  

    async question1(conn, Interaction, params) {
        let question = "1. What Soul do you want to use:"
        console.log("started individuation for:" + this.interaction.user.id)
        let Survey = await this.db.query(conn, `SELECT * FROM nyx_soul_data WHERE cord_id = "${this.interaction.user.id}" ORDER BY date desc`);

       // console.log(Survey[0])
        if(Survey.length >= 1) {
            if (Survey[0].wallet !== null && Survey[0].twitter_id !== null) {


                
                const alchemy = new Alchemy(this.config.alchemy);
                alchemy.network = Network.ETH_MAINNET 

 

                let user_wallets = await this.db.query(conn, `SELECT * FROM nyx_wallets_vault WHERE cord_id = "${this.interaction.user.id}" ORDER BY claimed_date desc`);

                var wallets = []
                user_wallets.forEach( w => {
                    wallets.push(w.wallet)
                })


                console.log("wallets:" + wallets.length + "for: " + this.interaction.user.id)
                // let wallet = Survey[0].wallet //"0x997Aa4DEE9392CEfec9656aC2Eb9Ce30174199A2"; //
                //let contract = "0x684E4ED51D350b4d76A3a07864dF572D24e6dC4c"; isekai
                //let contract = "0x23BeB57A15f0C8112561f6B3eC88337A376c1452"
                let contract = "0x4928c942D9334971afF7CCd4941A078bDCAC648D" //official
                //let contract = "0x91Ef6A34388D22D636B3d9293516A90F79362e01" old
        
                var components = [];

                for (var i=0; i < wallets.length; i++) {
                    const nfts = await alchemy.nft.getNftsForOwner(wallets[i], {contractAddresses: [contract], pageSize: 100});

                    if (nfts.ownedNfts.length <= 24) {
                        for(const e of nfts.ownedNfts) {
                            console.log("loop")
                            components.push(
                                {
                                    label: e.title,
                                    value: e.tokenId
                                }
                            )
                        };
                    } else {
                        await Interaction.editReply(
                            {
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("Red")
                                        .setDescription("Wow! That's a lot of SOULs :) open a ticket so we can help you.")
                                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                                        .setTimestamp()
                                ],
                            components: []
                            }
                        ).then().catch(console.error);
                        return
                    }
                }

                if ((components.length == 0)) {
                    await Interaction.editReply(
                        {
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("Red")
                                    .setDescription("You don't have Soul NFTs.")
                                    .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                                    .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                                    .setTimestamp()
                            ],
                        components: []
                        }
                    ).then().catch(console.error);
                    return
                }
                // const nfts = await alchemy.nft.getNftsForOwner(wallet, {contractAddresses: [contract], pageSize: 100});
              
                // if ((nfts.totalCount == 0)) {
                //     await Interaction.editReply(
                //         {
                //             embeds: [
                //                 new EmbedBuilder()
                //                     .setColor("Red")
                //                     .setDescription("You don't have Soul NFTs.")
                //                     .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                //                     .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                //                     .setTimestamp()
                //             ],
                //         components: []
                //         }
                //     ).then().catch(console.error);
                //     return
                // }

                
                // // let components = [];
                // for(const e of nfts.ownedNfts) {
                //     console.log("loop")
                //     components.push(
                //         {
                //             label: e.title,
                //             value: e.tokenId
                //         }
                //     )
                // };

                await Interaction.editReply(
                    {
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(question)
                                .setColor("Blue")
                                .setDescription(`Use the dropdown below to choose a Soul.`)
                                .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                                .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                                .setTimestamp()
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new SelectMenuBuilder()
                                        .setPlaceholder("Nothing Selected")
                                        .setCustomId("select")
                                        .addOptions(
                                            components
                                        )
                                )
                        ]
                    }
                ).then().catch(console.error);

                const filter = (i) => i.user.id === this.interaction.member.user.id && i.customId === "select";

                Interaction.channel.awaitMessageComponent(
                    {
                        filter,
                        time: 600000,
                    }
                ).then(
                    async (collected) => {
                        await collected.deferUpdate().then().catch(console.error);

                        params.souls = {
                            id: collected.values[0],
                            name: components.find(fn => fn.value === collected.values[0]).label
                        };

                       
                        await this.question2(conn, collected, params)
                    }
                ).catch(
                    async (err) => {

                    }
                );

            } else {
                await Interaction.editReply(
                    {
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setDescription("You must /activate on <#1027933315124166718> to proceed.")
                                .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                                .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                                .setTimestamp()
                        ]
                    }
                ).then().catch(console.error);
            }
        } else {
            await Interaction.editReply(
                {
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setDescription("You must /activate on <#1027933315124166718> to proceed.")
                            .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                            .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            .setTimestamp()
                    ]
                }
            ).then().catch(console.error);
        }

    }

    async question2(conn, Interaction, params) {
        let question = "2. Most of the time I'm driven by:"
        await Interaction.editReply(
            {
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setColor("Blue")
                        .setTitle(question)
                        .setDescription(`**Imagination:** When facing challenges I'm primarily driven by Imagination\n\n**Intellect:** When facing challenges I'm primarily driven by Intellect\n\n**Intuition:** When facing challenges I'm primarily driven by Intuition\n\n**Empathy:** When facing challenges I'm primarily driven by Empathy`)
                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                        .setTimestamp()
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new SelectMenuBuilder()
                                .setPlaceholder("Nothing Selected")
                                .setCustomId("select")
                                .addOptions(
                                    {
                                        label: "Imagination",
                                        value: "imagination"
                                    },
                                    {
                                        label: "Intellect",
                                        value: "intellect"
                                    },
                                    {
                                        label: "Intuition",
                                        value: "intuition"
                                    },
                                    {
                                        label: "Empathy",
                                        value: "empathy"
                                    },
                                )
                        )
                ]
            }
        ).then(async (QuestionMessage) => {
            const filter = (i) => i.user.id === this.interaction.member.user.id;

            QuestionMessage.awaitMessageComponent(
                {
                    filter,
                    time: 600000,
                }
            ).then(async (collected) => {
                await collected.deferUpdate().then().catch(console.error);
                let answer = collected.values[0];
                params.mainDriver = answer;

                await this.question3(conn, collected, params);
            }).catch(console.error);
        }).catch(console.error);
    }

    async question3(conn, Interaction, params) {
        let question = "3. Select your main kind:";
        let archetype = {
            imagination: [
                {
                    label: "Visionary",
                    description: "Imagination and persuasion, combined, can transform anything. Ignore common sense, bend, and reshape reality.",
                    value: "visionary"
                },
                {
                    label: "Creator",
                    description: "Vision without execution is hallucination. Let's create the future, one experiment at a time.",
                    value: "creator"
                }
            ],
            intellect: [
                {
                    label: "Explorer",
                    description: "The truth is out there and belongs to the people who are open, willing to be uncomfortable, and take the necessary risks to find it.",
                    value: "explorer"
                },
                {
                    label: "Mentor",
                    description: "Wisdom comes from investigating reality. Read, contemplate, research, and continually strive to turn ignorance into understanding.",
                    value: "mentor"
                },
                {
                    label: "Rebel",
                    description: "Break free from rules, rulers, and traditions. A chaotic environment can spike creativity, boost excitement, and keep life interesting.",
                    value: "rebel"
                },
            ],
            intuition: [
                {
                    label: "Leader",
                    description: "Strive to be a role model. Structure, not chaos, takes us closer to significant accomplishments in life.",
                    value: "leader"
                },
                {
                    label: "Grinder",
                    description: "Keep grinding. There is no better gift than the ability to self-motivate and keep moving forward during tough times.",
                    value: "grinder"
                },
                {
                    label: "Idealist",
                    description: "We must choose what is right; you can call me a dreamer if you will, yet, in the end, good always prevails.",
                    value: "idealist"
                },
                {
                    label: "Team Player",
                    description: "Collaboration is the ultimate path to success. The ultimate goal is to be surrounded by people we admire and trust.",
                    value: "team_player"
                },
            ],
            empathy: [
                {
                    label: "Angel",
                    description: "Encourage, support, and be empathetic toward others. Sometimes to the point of neglecting ourselves.",
                    value: "angel"
                },
                {
                    label: "Trailblazer",
                    description: "Life is about passion. Follow the bliss, the soul's path, and the rest will follow.",
                    value: "trailblazer"
                },
                {
                    label: "Entertainer",
                    description: "YOLO! We only live once, but if we make it fun enough, it more than suffices. It is not that serious.",
                    value: "entertainer"
                },
            ]
        };

        let stuff = [];
        let options = [];

        archetype[params.mainDriver].forEach((e) => {
            stuff.push(
                {
                    name: e.label,
                    value: e.description,
                    inline: false
                }
            )

            options.push(
                {
                    label: e.label,
                    value: e.value
                }
            )
        });

        await Interaction.editReply(
            {
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setColor("Blue")
                        .setTitle(question)
                        .addFields(stuff)
                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                        .setTimestamp()
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new SelectMenuBuilder()
                                .setPlaceholder("Nothing Selected")
                                .setCustomId("select")
                                .addOptions(
                                    options
                                )
                        )
                ]
            }
        ).then(async (QuestionMessage) => {
            const filter = (i) => i.user.id === this.interaction.member.user.id;

            QuestionMessage.awaitMessageComponent(
                {
                    filter,
                    time: 600000,
                }
            ).then(async (collected) => {
                await collected.deferUpdate().then().catch(console.error);
                let answer = collected.values[0];
                params.archetype = answer;

                await this.question4(conn, collected, params);
            }).catch(console.error);
        }).catch(console.error)
    }

    async question4(conn, Interaction, params) {
        params.soulFeatures = [];

        let options = [
            [
                "**Artist:** There is no reality, only perception and creation. Be open to seeing, hearing, and deeply connecting with your surroundings.",
                "**Connector:** The only way to recharge is surrounded by people, making connections, fostering relationships, appreciating others, and feeling valued in return.",
                "**Bonvivant:** If we can't have a good laugh and have fun doing it, why even bother? We only live once; this is it. So indulge, celebrate, and make it count." ,
                "**Still:** Adaptability and emotional control. Keep a steady mood no matter what comes your way." ,
                "**Blindfolded:** The scale should be blind. We need to keep fighting, whatever the cost, to build a society where everyone can access the same opportunities." ,
                "**Realist:** Life needs to be dealt with in a practical way. Be grounded, remain skeptical, and focus on today's challenges and opportunities." ,
                "**Controller:** Order and structure are the essential elements to tackle the challenges life throws our way. Organize before making moves." ,
                "**Agnostic:** There is a natural explanation for our existence. This life is all there is." ,
                "**Traditionalist:** Family, religion, and traditions are the foundation of our society. We should recognize the fundamental values established by previous generations." ,
                "**Aequanimus:** Keep it cool, even in challenging times. Always be that calm presence when others are frustrated." ,
            ],
            [
                "**Believer:** There is something bigger than us; different cultures give it other names, forms, and meanings." ,
                "**Nomad:** Most traditions anchor society in the past. We must keep moving forward, adapting, evolving, and embracing change, even if this means breaking up traditions." ,
                "**Modernist:** Progress is the ultimate goal. Society perishes when entangled in old traditions and blossoms when ready to embrace change and move forward." ,
                "**Player:** Life is just a game; take losses lightly, keep playing, experimenting, and taking risks." ,
                "**Poet:** The emotional rollercoaster. The ups are high; The downs are low. But this is what makes it all genuine, creative, and unique." ,
                "**Simulation:** Members of an advanced civilization might have decided to run simulations. Statistics suggest it is likely we are among these." ,
                "**Director:** Take charge. Sometimes, we must take the wheel unapologetically to get things done properly." ,
                "**Like water:** Be more like water, Bruce Lee once said. Adapt to and accept things as they are. There's no point in getting frustrated when things don't go our way." ,
                "**Optimistic:** Keep a positive mind in the face of adversity. There is high power in seeing the glass half-full all the time." ,
                "**Enthusiast:** Motivation is built-in; it comes from within. This constant energy flow is enough to lighten us up and motivate others." ,
            ],
            [
                "**Shapeshifter:** There are moments in which we love being surrounded by people and others where we crave to be left alone, recharging by working on our craft, or just getting lost in our thoughts." ,
                "**Jumper:** Why be afraid to go first? It may be scary to dive head-first on a challenge, but there is no better way to wake up the butterflies in our stomachs." ,
                "**Seeker:** To feel alive is to keep discovering and experimenting with new things, even if they happen to be weird or uncomfortable." ,
                "**Achiever:** Life is about keeping sharp and crushing goals. Enjoy the wins, but only spend a little time celebrating them. Instead, move forward to reach the next milestone." ,
                "**Champion:** Without debates and friction, there is no growth. Competition sharpens the soul and forges winning teams." ,
                "**Juggler:** Multi-tasking is the ultimate ability one needs to seize the right opportunities nowadays." ,
                "**Keeper:** Between the most important things in life are traditions. When we observe traditions, we are protecting essential values to be carried by the next generations." ,
                "**Guided:** Everything happens for a reason. Our lives are connected to a higher guiding force." ,
                "**Servant:** The ultimate joy is to be of service. Nothing brings more joy than putting others first, even if it means neglecting ourselves." ,
                "**Original:** Choose to do things the authentic way. Keep it a bit weird, remain curious, and resist the pressure to conform." ,
            ],
            [
                "**Empathetic:** Connecting deeply to others' emotions, feeling what they are feeling, and seeing it through their eyes. It can be exhaustive sometimes, but I can't help but do it." ,
                "**Ingenious:** Being surrounded by people is exhaustive. The only way we recharge is by spending quiet time. Quiet moments are the creative thinking holy grail." ,
                "**Ally:** Combativeness always leads to the worst possible outcome. Cooperation is a better tool than confrontation. No exceptions. Be humble, and keep it friendly no matter what." ,
                "**Perfectionist:** Perfection is not the ultimate goal but the blueprint. Be diligent and self-disciplined, and always strive for exceptional craftsmanship." ,
                "**Adventurer:** Dare to be uncomfortable. There is an entirely new dimension to our beings that we can only tap into if we open ourselves to exploration." ,
                "**Moderator:** There are no absolute truths when it comes to socio-economical issues. Dialog and compromise between conservatives and liberals usually lead to better policies."
            ]
        ];

        let menuOptions = [
            [
                {
                    label: "Artist",
                    value: "artist"
                },
                {
                    label: "Connector",
                    value: "connector"
                },
                {
                    label: "Bonvivant",
                    value: "bonvivant"
                },
                {
                    label: "Still",
                    value: "still"
                },
                {
                    label: "Blindfolded",
                    value: "blindfolded"
                },
                {
                    label: "Realist",
                    value: "realist"
                },
                {
                    label: "Controller",
                    value: "controller"
                },
                {
                    label: "Agnostic",
                    value: "agnostic"
                },
                {
                    label: "Traditionalist",
                    value: "traditionalist"
                },
                {
                    label: "Aequanimus",
                    value: "aequanimus"
                },
            ],
            [
                {
                    label: "Believer",
                    value: "believer"
                },
                {
                    label: "Nomad",
                    value: "nomad"
                },
                {
                    label: "Modernist",
                    value: "modernist"
                },
                {
                    label: "Player",
                    value: "player"
                },
                {
                    label: "Poet",
                    value: "poet"
                },
                {
                    label: "Simulation",
                    value: "simulation"
                },
                {
                    label: "Director",
                    value: "director"
                },
                {
                    label: "Like water",
                    value: "like_water"
                },
                {
                    label: "Optimistic",
                    value: "optimistic"
                },
                {
                    label: "Enthusiast",
                    value: "enthusiast"
                },
            ],
            [
                {
                    label: "Shapeshifter",
                    value: "shapeshifter",
                },
                {
                    label: "Jumper",
                    value: "jumper",
                },
                {
                    label: "Seeker",
                    value: "seeker",
                },
                {
                    label: "Achiever",
                    value: "achiever",
                },
                {
                    label: "Champion",
                    value: "champion",
                },
                {
                    label: "Juggler",
                    value: "juggler",
                },
                {
                    label: "Keeper",
                    value: "keeper",
                },
                {
                    label: "Guided",
                    value: "guided",
                },
                {
                    label: "Servant",
                    value: "servant",
                },
                {
                    label: "Original",
                    value: "original",
                },
            ],
            [
                {
                    label: "Empathetic",
                    value: "empathetic"
                },
                {
                    label: "Ingenious",
                    value: "ingenious"
                },
                {
                    label: "Ally",
                    value: "ally"
                },
                {
                    label: "Perfectionist",
                    value: "perfectionist"
                },
                {
                    label: "Adventurer",
                    value: "adventurer"
                },
                {
                    label: "Moderator",
                    value: "moderator"
                }
            ]
        ]

        let embeds = [];

        options.forEach((e) => {
            let description = "";
           description = "Please select your Soul kinds through the selector below. Use the arrow buttons to navigate through pages:\n\n";
            e.forEach((f) => {
                description += `${f}\n\n`;
            });

            embeds.push(
                new EmbedBuilder()
                    .setColor("Blue")
                    .setTitle("4. Select 12 Soul kinds that best represent you")
                    .setDescription(description)
                    .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                    .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                    .setTimestamp()
            );
        });

        let page = 0;

        for(let i = 0; i < 12; i++) {
            let interaction = Interaction;

            let components = [];

            if(menuOptions[page].length < 1) {
                components.push(
                    new ActionRowBuilder()
                        .addComponents(
                            new SelectMenuBuilder()
                                .setPlaceholder("Nothing Selected")
                                .setCustomId("select")
                                .setOptions(
                                    {
                                        label: "true",
                                        value: "true"
                                    }
                                )
                                .setDisabled(true)
                        ),
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("⬅️")
                                .setCustomId("left")
                                .setStyle("Primary")
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("➡️")
                                .setCustomId("right")
                                .setStyle("Primary")
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Reset")
                                .setCustomId("reset")
                                .setStyle("Primary")
                        )
                )
            } else {
                components.push(
                    new ActionRowBuilder()
                        .addComponents(
                            new SelectMenuBuilder()
                                .setPlaceholder("Nothing Selected")
                                .setCustomId("select")
                                .setOptions(
                                    menuOptions[page]
                                )
                        ),
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("⬅️")
                                .setCustomId("left")
                                .setStyle("Primary")
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("➡️")
                                .setCustomId("right")
                                .setStyle("Primary")
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Reset")
                                .setCustomId("reset")
                                .setStyle("Primary")
                        )
                )
            }

            await interaction.editReply(
                {
                    ephemeral: true,
                    embeds: [
                        embeds[page]
                    ],
                    components: components
                }
            ).then(async (messageSelector) => {
                const filter = (i) => i.user.id === this.interaction.member.user.id;

                await messageSelector.awaitMessageComponent(
                    {
                        filter,
                        time: 600000
                    }
                ).then(async (collected) => {
                    await collected.deferUpdate().then().catch(console.error);
                    let components = [];

                    switch (collected.customId) {
                        case "right":
                            i -= 1
                            if(typeof embeds[page+1] !== "undefined") {
                                page += 1
                            }

                            components = [];

                            if(menuOptions[page].length < 1) {
                                components.push(
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new SelectMenuBuilder()
                                                .setPlaceholder("Nothing Selected")
                                                .setCustomId("select")
                                                .setOptions(
                                                    {
                                                        label: "true",
                                                        value: "true"
                                                    }
                                                )
                                                .setDisabled(true)
                                        ),
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("⬅️")
                                                .setCustomId("left")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("➡️")
                                                .setCustomId("right")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("Reset")
                                                .setCustomId("reset")
                                                .setStyle("Primary")
                                        )
                                )
                            } else {
                                components.push(
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new SelectMenuBuilder()
                                                .setPlaceholder("Nothing Selected")
                                                .setCustomId("select")
                                                .setOptions(
                                                    menuOptions[page]
                                                )
                                        ),
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("⬅️")
                                                .setCustomId("left")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("➡️")
                                                .setCustomId("right")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("Reset")
                                                .setCustomId("reset")
                                                .setStyle("Primary")
                                        )
                                )
                            }

                            await collected.editReply(
                                {
                                    ephemeral: true,
                                    embeds: [
                                        embeds[page]
                                    ],
                                    components: components
                                }
                            ).then().catch(console.error);

                            break;
                        case "left":
                            i -= 1
                            interaction = collected;
                            if(typeof embeds[page-1] !== "undefined") {
                                page -= 1
                            }

                            components = [];

                            if(menuOptions[page].length < 1) {
                                components.push(
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new SelectMenuBuilder()
                                                .setPlaceholder("Nothing Selected")
                                                .setCustomId("select")
                                                .setOptions(
                                                    {
                                                        label: "true",
                                                        value: "true"
                                                    }
                                                )
                                                .setDisabled(true)
                                        ),
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("⬅️")
                                                .setCustomId("left")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("➡️")
                                                .setCustomId("right")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("Reset")
                                                .setCustomId("reset")
                                                .setStyle("Primary")
                                        )
                                )
                            } else {
                                components.push(
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new SelectMenuBuilder()
                                                .setPlaceholder("Nothing Selected")
                                                .setCustomId("select")
                                                .setOptions(
                                                    menuOptions[page]
                                                )
                                        ),
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("⬅️")
                                                .setCustomId("left")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("➡️")
                                                .setCustomId("right")
                                                .setStyle("Primary")
                                        )
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setLabel("Reset")
                                                .setCustomId("reset")
                                                .setStyle("Primary")
                                        )
                                )
                            }

                            await collected.editReply(
                                {
                                    ephemeral: true,
                                    embeds: [
                                        embeds[page]
                                    ],
                                    components: components
                                }
                            ).then().catch(console.error);

                            break;
                        case "select":
                            let answer = collected.values[0].replace("_", " ")
                            answer = answer.charAt(0).toUpperCase() + answer.slice(1);

                            embeds[page].data.description = embeds[page].data.description.replace(`**${answer}:**`, `✅ **${answer}**`);

                            const index = menuOptions[page].indexOf(menuOptions[page].find(fn => fn.value === collected.values[0]));
                            if (index > -1) { // only splice array when item is found
                                menuOptions[page].splice(index, 1); // 2nd parameter means remove one item only
                            }

                            params.soulFeatures.push(collected.values[0]);

                            if(i === 11) {
                                await this.question5(conn, Interaction, params);
                            }

                            break;
                        case "reset":
                            i = 12;
                            await this.question4(conn, Interaction, params);
                            break;
                    }
                }).catch(console.error);
            }).catch(console.error);
        }
    }

    async question5(conn, Interaction, params) {
        let options = [
            {
                name: "Artist",
                description: "There is no reality, only perception and creation. Be open to seeing, hearing, and deeply connecting with your surroundings."
            },
            {
                name: "Connector",
                description: "The only way to recharge is surrounded by people, making connections, fostering relationships, appreciating others, and feeling valued in return."
            },
            {
                name: "Bonvivant",
                description: "If we can't have a good laugh and have fun doing it, why even bother? We only live once; this is it. So indulge, celebrate, and make it count."
            },
            {
                name: "Still",
                description: "Adaptability and emotional control. Keep a steady mood no matter what comes your way."
            },
            {
                name: "Blindfolded",
                description: "The scale should be blind. We need to keep fighting, whatever the cost, to build a society where everyone can access the same opportunities."
            },
            {
                name: "Realist",
                description: " Life needs to be dealt with in a practical way. Be grounded, remain skeptical, and focus on today's challenges and opportunities."
            },
            {
                name: "Controller",
                description: "Order and structure are the essential elements to tackle the challenges life throws our way. Organize before making moves."
            },
            {
                name: "Agnostic",
                description: "There is a natural explanation for our existence. This life is all there is."
            },
            {
                name: "Traditionalist",
                description: "Family, religion, and traditions are the foundation of our society. We should recognize the fundamental values established by previous generations."
            },
            {
                name: "Aequanimus",
                description: "Keep it cool, even in challenging times. Always be that calm presence when others are frustrated."
            },
            {
                name: "Believer",
                description: "There is something bigger than us; different cultures give it other names, forms, and meanings."
            },
            {
                name: "Nomad",
                description: "Most traditions anchor society in the past. We must keep moving forward, adapting, evolving, and embracing change, even if this means breaking up traditions."
            },
            {
                name: "Modernist",
                description: "Progress is the ultimate goal. Society perishes when entangled in old traditions and blossoms when ready to embrace change and move forward."
            },
            {
                name: "Player",
                description: "Life is just a game; take losses lightly, keep playing, experimenting, and taking risks."
            },
            {
                name: "Poet",
                description: "The emotional rollercoaster. The ups are high; The downs are low. But this is what makes it all genuine, creative, and unique."
            },
            {
                name: "Simulation",
                description: "Members of an advanced civilization might have decided to run simulations. Statistics suggest it is likely we are among these."
            },
            {
                name: "Director",
                description: "Take charge. Sometimes, we must take the wheel unapologetically to get things done properly."
            },
            {
                name: "Like water",
                description: "Be more like water, Bruce Lee once said. Adapt to and accept things as they are. There's no point in getting frustrated when things don't go our way."
            },
            {
                name: "Optimistic",
                description: "Keep a positive mind in the face of adversity. There is high power in seeing the glass half-full all the time."
            },
            {
                name: "Enthusiast",
                description: "Motivation is built-in; it comes from within. This constant energy flow is enough to lighten us up and motivate others."
            },
            {
                name: "Shapeshifter",
                description: "There are moments in which we love being surrounded by people and others where we crave to be left alone, recharging by working on our craft, or just getting lost in our thoughts."
            },
            {
                name: "Jumper",
                description: "Why be afraid to go first? It may be scary to dive head-first on a challenge, but there is no better way to wake up the butterflies in our stomachs."
            },
            {
                name: "Seeker",
                description: "To feel alive is to keep discovering and experimenting with new things, even if they happen to be weird or uncomfortable."
            },
            {
                name: "Achiever",
                description: "Life is about keeping sharp and crushing goals. Enjoy the wins, but only spend a little time celebrating them. Instead, move forward to reach the next milestone."
            },
            {
                name: "Champion",
                description: "Without debates and friction, there is no growth. Competition sharpens the soul and forges winning teams."
            },
            {
                name: "Juggler",
                description: "Multi-tasking is the ultimate ability one needs to seize the right opportunities nowadays."
            },
            {
                name: "Keeper",
                description: "Between the most important things in life are traditions. When we observe traditions, we are protecting essential values to be carried by the next generations."
            },
            {
                name: "Guided",
                description: "Everything happens for a reason. Our lives are connected to a higher guiding force."
            },
            {
                name: "Servant",
                description: "The ultimate joy is to be of service. Nothing brings more joy than putting others first, even if it means neglecting ourselves."
            },
            {
                name: "Original",
                description: "Choose to do things the authentic way. Keep it a bit weird, remain curious, and resist the pressure to conform."
            },
            {
                name: "Empathetic",
                description: "Connecting deeply to others' emotions, feeling what they are feeling, and seeing it through their eyes. It can be exhaustive sometimes, but I can't help but do it."
            },
            {
                name: "Ingenious",
                description: "Being surrounded by people is exhaustive. The only way we recharge is by spending quiet time. Quiet moments are the creative thinking holy grail."
            },
            {
                name: "Ally",
                description: "Combativeness always leads to the worst possible outcome. Cooperation is a better tool than confrontation. No exceptions. Be humble, and keep it friendly no matter what."
            },
            {
                name: "Perfectionist",
                description: "Perfection is not the ultimate goal but the blueprint. Be diligent and self-disciplined, and always strive for exceptional craftsmanship."
            },
            {
                name: "Adventurer",
                description: "Dare to be uncomfortable. There is an entirely new dimension to our beings that we can only tap into if we open ourselves to exploration."
            },
            {
                name: "Moderator",
                description: "There are no absolute truths when it comes to socio-economical issues. Dialog and compromise between conservatives and liberals usually lead to better policies."
            }
        ];

        let description = "";
        let optionsComp = [];
        let ranks = [];

        params.soulFeatures.forEach((e) => {
            let name = e.replace("_", " ");
            name = name.charAt(0).toUpperCase() + name.slice(1);

            description += `0️⃣ **${name}** ${options.find(fn => fn.name === name).description}\n\n`;

            ranks.push(
                {
                    rank: 99,
                    description: `0️⃣ **${name}** ${options.find(fn => fn.name === name).description}\n\n`,
                    name: name
                }
            )

            optionsComp.push(
                {
                    label: name,
                    value: name
                }
            )
        });

        params.soulFeaturesRank = [];

        for(let i = 0; i < 12; i++) {
            await Interaction.editReply(
                {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("5. Rank your Soul kinds with #1 being the one that represents you the most and #12 the one that represents you the least in this group.")
                            .setDescription(`The first 8 kinds will appear in your Soul NFT along with your main kind.\n\n${description}`)
                            .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                            .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                            .setTimestamp()
                            .setColor("Blue")
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new SelectMenuBuilder()
                                    .setCustomId("select")
                                    .setPlaceholder("Nothing Selected")
                                    .setOptions(optionsComp)
                            ),
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel("Reset")
                                    .setCustomId("reset2")
                                    .setStyle("Primary")
                            )
                    ]
                }
            ).then(async (messageSelector) => {
                const filter = (i) => i.user.id === this.interaction.member.user.id;

                await messageSelector.awaitMessageComponent(
                    {
                        filter,
                        time: 600000
                    }
                ).then(async (collected) => {
                    await collected.deferUpdate().then().catch(console.error);

                    if(collected.customId === "select") {
                        let answer = collected.values[0];

                        params.soulFeaturesRank.push(
                            {
                                rank: i+1,
                                name: answer
                            }
                        );

                        const index = optionsComp.indexOf(optionsComp.find(fn => fn.value === collected.values[0]));
                        if (index > -1) { // only splice array when item is found
                            optionsComp.splice(index, 1); // 2nd parameter means remove one item only
                        }

                        let fetchLine = `0️⃣ **${options.find(fn => fn.name === collected.values[0].replace("_", " ")).name}** ${options.find(fn => fn.name === collected.values[0].replace("_", " ")).description}`;
                        let newLine = `${await this.sortEmojiWithRank(i+1)} **${options.find(fn => fn.name === collected.values[0].replace("_", " ")).name}** ${options.find(fn => fn.name === collected.values[0].replace("_", " ")).description}`
                        description = description.replace(fetchLine, newLine);

                        ranks.find(fn => fn.description === fetchLine + "\n\n").rank = i+1;
                        ranks.find(fn => fn.description === fetchLine + "\n\n").description = newLine + "\n\n";


                        ranks.sort((a, b) => {
                            return a.rank - b.rank;
                        })

                        description = "";

                        ranks.forEach((e) => {
                            description += `${e.description}`;
                        });

                        if(i === 11) {
                            await this.processSubmission(conn, ranks, params, Interaction);
                        }

                    } else if(collected.customId === "reset2") {
                        i = 12
                        await this.question5(conn, Interaction, params);
                    }

                }).catch(console.error);
            }).catch(console.error);
        }
    }

    async processSubmission(conn, ranks, params, Interaction) {
        ranks.sort((a, b) => {
            return a.rank - b.rank;
        })

        let description = "";

        ranks.forEach((e) => {
            description += `${e.description}`;
        });

        params.soulFeaturesRank = ranks;

        await Interaction.editReply(
            {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("5. Rank your Soul kinds with #1 being the one that represents you the most and #12 the one that represents you the least in this group.")
                        .setDescription(`The first 8 kinds will appear in your Soul NFT along with your main kind.\n\n${description}`)
                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                        .setTimestamp()
                        .setColor("Blue")
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Confirm")
                                .setStyle("Success")
                                .setCustomId("yes_finish")
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Cancel")
                                .setStyle("Danger")
                                .setCustomId("no_finish")
                        )
                ]
            }
        ).then(async (MessageConfirmation) => {
            const filter = (i) => i.user.id === this.interaction.member.user.id;

            await MessageConfirmation.awaitMessageComponent(
                {
                    filter,
                    time: 600000
                }
            ).then(async (collected) => {
                await collected.deferUpdate().then().catch(console.error);

                switch (collected.customId) {
                    case "yes_finish":

                        let kinds = await this.formatKindsDbEntry(params)
                        // for (var i = 0; i < params.soulFeaturesRank.length; i++) {
                        //     params.soulFeaturesRank[i].name = this.formatKindsDbEntry(params.soulFeaturesRank[i].name)
                        // }

                       // params.soulFeaturesRank[0].name = this.formatKindsDbEntry(params.soulFeaturesRank[0].name)
                        
                        //await this.db.query(conn, `INSERT INTO nyx_soul_data (cord_id, twitter_id, twitter_name,  main_driver, archetype, soul_1, soul_2, soul_3, soul_4, soul_5, soul_6, soul_7, soul_8, soul_9, soul_10, soul_11, soul_12, date) VALUES ("${this.interaction.user.id}", "${params.twitter_id}", "${params.twitter_name}", "${params.mainDriver}", "${params.archetype}", "${params.soulFeaturesRank[0].name}", "${params.soulFeaturesRank[1].name}", "${params.soulFeaturesRank[2].name}", "${params.soulFeaturesRank[3].name}", "${params.soulFeaturesRank[4].name}", "${params.soulFeaturesRank[5].name}", "${params.soulFeaturesRank[6].name}", "${params.soulFeaturesRank[7].name}", "${params.soulFeaturesRank[8].name}", "${params.soulFeaturesRank[9].name}", "${params.soulFeaturesRank[10].name}", "${params.soulFeaturesRank[11].name}", UTC_TIMESTAMP())`);
                        // [this.interaction.user.id, params.twitter_id,params.twitter_name,params.mainDriver,params.archetype, params.soulFeaturesRank[0].name, params.soulFeaturesRank[1].name, params.soulFeaturesRank[2].name, params.soulFeaturesRank[3].name, params.soulFeaturesRank[4].name, params.soulFeaturesRank[5].name, params.soulFeaturesRank[6].name, params.soulFeaturesRank[7].name, params.soulFeaturesRank[8].name, params.soulFeaturesRank[9].name, params.soulFeaturesRank[10].name, params.soulFeaturesRank[11].name], params.souls.id, params.souls.name);
                       // await this.db.query(conn, `UPDATE nyx_soul_data SET main_driver = "${params.mainDriver}", archetype = "${params.archetype}", soul_1 = "${params.soulFeaturesRank[0].name}", soul_2 = "${params.soulFeaturesRank[1].name}", soul_3 = "${params.soulFeaturesRank[2].name}", soul_4 = "${params.soulFeaturesRank[3].name}", soul_5 = "${params.soulFeaturesRank[4].name}", soul_6 = "${params.soulFeaturesRank[5].name}", soul_7 = "${params.soulFeaturesRank[6].name}", soul_8 = "${params.soulFeaturesRank[7].name}", soul_9 = "${params.soulFeaturesRank[8].name}", soul_10 = "${params.soulFeaturesRank[9].name}", soul_11 = "${params.soulFeaturesRank[10].name}", soul_12 = "${params.soulFeaturesRank[11].name}", soul_id = ${params.souls.id}, soul_type = 1, date = UTC_TIMESTAMP() WHERE cord_id = "${this.interaction.user.id}"`) //soul_type = "${params.souls.name}"
                       
                       await this.db.query(conn, `UPDATE nyx_soul_data SET main_driver = "${params.mainDriver}", archetype = "${params.archetype}", soul_1 = "${kinds[0]}", soul_2 = "${kinds[1]}", soul_3 = "${kinds[2]}", soul_4 = "${kinds[3]}", soul_5 = "${kinds[4]}", soul_6 = "${kinds[5]}", soul_7 = "${kinds[6]}", soul_8 = "${kinds[7]}", soul_9 = "${kinds[8]}", soul_10 = "${kinds[9]}", soul_11 = "${kinds[10]}", soul_12 = "${kinds[11]}", soul_id = ${params.souls.id}, soul_type = 1, date = UTC_TIMESTAMP() WHERE cord_id = "${this.interaction.user.id}"`) //soul_type = "${params.souls.name}"
                    
                       var kindredRole = await this.getKindredRoleFor(params.archetype)

                       var roles = ["1032081077533151264", kindredRole] // Soulbind, kindred
                       collected.member.roles.add(roles);

                       console.log("Finished Individuation for: " + this.interaction.user.id)

                        //  await this.db.query(conn, `INSERT INTO dc_survey_users (cord_id, status) VALUES ("${this.interaction.user.id}", "done")`);
                        await collected.editReply(
                            {
                                ephemeral: true,
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle("Soul Individuation")
                                        .setDescription(`> Hey ${this.interaction.user}, you successfully completed the Individuation.`)
                                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                                        .setTimestamp()
                                        .setColor("Green")
                                ],
                                components: []
                            }
                        ).then().catch(console.error);
                        break;
                    case "no_finish":
                        await collected.editReply(
                            {
                                ephemeral: true,
                                embeds: [
                                    new EmbedBuilder()
                                        .setDescription(`> Hey ${this.interaction.user}, you just cancelled the Individuation. You can start again anytime.`)
                                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                                        .setTimestamp()
                                        .setColor("Red")
                                ],
                                components: []
                            }
                        ).then().catch(console.error);
                        break;
                }
            }).catch(console.error);
        }).catch(console.error);
    }

    async twitterVerification(name) {

        let User = await needle(
            "get",
            `https://api.twitter.com/2/users/by/username/${name}?user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,url,username,verified,withheld,public_metrics`,
            {
                headers: {
                    authorization: `Bearer ${this.config.twitter.bearer_token}`
                }
            }
        );

        console.log(User.body)

        return User.body.title === "Invalid Request" ? [false] : [true, User.body.data.id];
    }

    async sortEmojiWithRank(rank) {
        switch (rank) {
            case 1:
                return "1️⃣";
            case 2:
                return "2️⃣";
            case 3:
                return "3️⃣";
            case 4:
                return "4️⃣";
            case 5:
                return "5️⃣";
            case 6:
                return "6️⃣";
            case 7:
                return "7️⃣";
            case 8:
                return "8️⃣";
            case 9:
                return "9️⃣";
            case 10:
                return "1️⃣0️⃣";
            case 11:
                return "1️⃣1️⃣";
            case 12:
                return "1️⃣2️⃣";
        }
    }

    async processError(interaction, err) {
        console.error(err)
        await interaction.reply(
            {
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setDescription(`Hey ${this.interaction.user}, Something went wrong. You took too much time to answer the question.`)
                        .setAuthor({name: this.client.user.username, iconURL: this.client.user.avatarURL()})
                        .setFooter({text: this.interaction.guild.name, iconURL: this.interaction.guild.iconURL()})
                        .setTimestamp()
                ],
                components: []
            }
        ).then().catch(console.error);
    }

    async formatKindsDbEntry(params) {
       var soulKinds = []

       for (var i = 0; i < params.soulFeaturesRank.length; i++) {
        soulKinds[i] = (params.soulFeaturesRank[i].name.replace(" ", "_")).toLowerCase()
       }

       return soulKinds
    }

    async getKindredRoleFor(archetype) {
        switch (archetype) {
            case "angel":
                return "1040638975070703697"
            case "creator":
                return "1040638975070703697"
            case "leader":
                return "1040638975070703697"
            case "idealist":
                return "1042460495627685918"
            case "mentor":
                return "1042460495627685918"
            case "explorer":
                return "1042460495627685918"
            case "trailblazer":
                return "1042460520239870054"
            case "bonvivant":
                return "1042460520239870054"
            case "team_player":
                return "1042460520239870054"
            case "rebel":
                return "1042460914206642218"
            case "visionary":
                return "1042460914206642218"
            case "grinder":
                return "1042460914206642218"                  
        }

    }
}

module.exports = {
    SurveyManager
}

