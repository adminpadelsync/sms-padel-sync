import { getGroupDetails } from '../actions'
import { GroupDetailsClient } from '../group-details-client'
import { notFound } from 'next/navigation'

export default async function GroupDetailsPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = await params
    let data;
    try {
        console.log('Fetching group details for:', groupId)
        data = await getGroupDetails(groupId)
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

    return <GroupDetailsClient group={data.group} members={data.members} />
}
