import { getGroupDetails } from '../actions'
import { GroupDetailsClient } from '../group-details-client'
import { redirect, notFound } from 'next/navigation'

export default async function GroupDetailsPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = await params
    try {
        console.log('Fetching group details for:', groupId)
        const { group, members } = await getGroupDetails(groupId)

        return <GroupDetailsClient group={group} members={members} />
    } catch (error) {
        console.error('Error fetching group details:', error)
        if (error instanceof Error) {
            console.error(error.message)
            console.error(error.stack)
        } else {
            console.error(JSON.stringify(error, null, 2))
        }
        notFound()
    }
}
