



```
ngrok http http://localhost:8080 --domain=ultimate-readily-ram.ngrok-free.app
```

Configure webhook
https://dashboard.alchemy.com/webhooks

Webhook url for localhost:
https://ultimate-readily-ram.ngrok-free.app/notify

Alchemy GraphQL Config

```
# With Alchemy GraphQL Webhooks you can ingest real-time updates for every block
# in a reliable, scalable, and secure way!
#
# If you're new to GraphQL, this editor has autocomplete enabled and will magically
# suggest fields as you start typing. If you get lost, you can always search the
# available queries in the docs tab on the right!
#
# To get you started, here's a GraphQL query that will get you all log events for
# every new block. Each log also includes a full transaction receipt!
#
# For more example use cases & queries visit
# https://docs.alchemy.com/reference/custom-webhooks-quickstart
#
{
  block (hash: "0x2fbf5fb2c9def4b4d8c697889efd00f84c776471b2cf223e3c77039fe7e39402"){ // block hash only for test purposes
    # Block hash is a great primary key to use for your data stores!
    hash,
    number,
    timestamp,
    # Add smart contract addresses to the list below to filter for specific logs
    logs(filter: {addresses: ["0x0b61c4f33bcdef83359ab97673cb5961c6435f4e", "0x32558f1214bd874c6cbc1ab545b28a18990ff7ee"], topics: [["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"],[]]}) {
      data,
      topics,
      index,
      account {
        address
      },
      transaction {
        hash,
        nonce,
        index,
        from {
          address
        },
        to {
          address
        },
        value,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        gas,
        status,
        gasUsed,
        cumulativeGasUsed,
        effectiveGasPrice,
        createdContract {
          address
        }
      }
    }
  }
}

```