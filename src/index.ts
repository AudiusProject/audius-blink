import {
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from './openapi';
import { prepareTransaction } from './transaction-utils';
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token"
import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
} from '@solana/actions';
import { Buffer } from "buffer";
import { cors } from 'hono/cors'

// @ts-ignore
globalThis.Buffer = Buffer;

const TIP_AMOUNT_AUDIO_OPTIONS = [1, 10, 20];
const DEFAULT_TIP_AMOUNT_AUDIO = 1;
const AUDIUS_RPC = 'https://discoveryprovider.audius.co'
const AUDIO_DECIMALS = 8
const AUDIO_MINT = '9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM'

const app = new OpenAPIHono();

type User = {
	name: string
	bio: string
	spl_wallet: string
	profile_picture: {
		'1000x1000': string
	}
}

type AudiusResponse = {
	data: User
}

app.use('*', cors())

app.openapi(
  createRoute({
    method: 'get',
    path: '/{handle}',
		request: {
			params: z.object({
				handle: z
					.string()
					.openapi({
						param: {
							name: 'handle',
							in: 'path',
						},
						example: 'skrillex',
					}),
			})
		},
    tags: ['Tip'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
		const { handle } = c.req.valid('param')
		const userRes = await fetch(`${AUDIUS_RPC}/v1/users/handle/${handle}`)
		const user = (await userRes.json() as AudiusResponse).data
		const { name, profile_picture, bio } = user

    const amountParameterName = 'amount';
    const response: ActionGetResponse = {
      icon: profile_picture['1000x1000'],
      label: `${DEFAULT_TIP_AMOUNT_AUDIO} $AUDIO`,
      title: `${name} (@${handle}) on Audius`,
      description: bio,
      links: {
        actions: [
          ...TIP_AMOUNT_AUDIO_OPTIONS.map((amount) => ({
            label: `${amount} $AUDIO`,
            href: `/${handle}/${amount}`,
          })),
          {
            href: `/${handle}/{${amountParameterName}}`,
            label: 'Tip',
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom $AUDIO amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response, 200);
  },
);


app.openapi(
  createRoute({
    method: 'get',
    path: '/{handle}/{amount}',
    tags: ['Tip'],
    request: {
      params: z.object({
				handle: z
					.string()
					.openapi({
						param: {
							name: 'handle',
							in: 'path',
						},
						example: 'skrillex',
					}),
        amount: z.string().openapi({
          param: {
            name: 'amount',
            in: 'path',
          },
          type: 'number',
          example: '1',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const amount = c.req.param('amount');
		const { handle } = c.req.valid('param')

    const userRes = await fetch(`${AUDIUS_RPC}/v1/users/handle/${handle}`)
		const user = (await userRes.json() as AudiusResponse).data
		const { name, profile_picture, bio } = user

    const response: ActionGetResponse = {
      icon: profile_picture['1000x1000'],
      label: `${amount} $AUDIO`,
      title: `${name} (@${handle}) on Audius`,
      description: bio,
    };
    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{handle}/{amount}',
    tags: ['Tip'],
    request: {
      params: z.object({
				handle: z
					.string()
					.openapi({
						param: {
							name: 'handle',
							in: 'path',
						},
						example: 'skrillex',
					}),
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const amount =
      c.req.param('amount') ?? DEFAULT_TIP_AMOUNT_AUDIO.toString();
    const { account } = (await c.req.json()) as ActionPostRequest;
		const { handle } = c.req.valid('param')

		const userRes = await fetch(`${AUDIUS_RPC}/v1/users/handle/${handle}`)
		const user = (await userRes.json() as AudiusResponse).data
		const { spl_wallet } = user

    const parsedAmount = parseFloat(amount);
    const transaction = await prepareTipTransaction(
      new PublicKey(account),
      new PublicKey(spl_wallet),
      parsedAmount * Math.pow(10, AUDIO_DECIMALS),
    );
    const response: ActionPostResponse = {
      transaction: Buffer.from(transaction.serialize()).toString('base64'),
    };
    return c.json(response, 200);
  },
);

async function prepareTipTransaction(
  sender: PublicKey,
  recipient: PublicKey,
  audioAmount: number,
): Promise<VersionedTransaction> {
  const payer = new PublicKey(sender);
	let sourceAccount = await getAssociatedTokenAddress(
		new PublicKey(AUDIO_MINT),
		sender
	)
  const instructions = [
		createTransferInstruction(
			sourceAccount,
			new PublicKey(recipient),
			payer,
			audioAmount
		)
  ];
  return prepareTransaction(instructions, payer);
}

export default app
