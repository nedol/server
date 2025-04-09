export default async function postToLinkedIn(accessToken, message) {
    try {
        const organizationId = "105206891"; // ID компании Kolmit
        const response = await axios.post("https://api.linkedin.com/v2/ugcPosts", {
            author: `urn:li:organization:${organizationId}`,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: { text: message },
                    shareMediaCategory: "NONE"
                }
            },
            visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
        }, { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } });

        console.log("✅ Пост успешно опубликован:", response.data);
    } catch (error) {
        console.error("❌ Ошибка публикации:", error.response ? error.response.data : error.message);
    }
}
