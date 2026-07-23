package com.hackathon.service;

import com.hackathon.dto.InvestmentInsightRequest;
import com.hackathon.dto.InvestmentInsightResponse;
import com.hackathon.dto.MarketContext;
import com.hackathon.dto.MarketNews;
import com.hackathon.market.MarketContextService;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class InvestmentInsightService {
	
	  private static final Log logger = LogFactory.getLog(InvestmentInsightService.class);
	

    private final ChatClient chatClient;
    private final MarketContextService marketContextService;

    public InvestmentInsightService(ChatClient.Builder builder, MarketContextService mContextService) {
        this.chatClient = builder.build();
		this.marketContextService = mContextService;
    }

    public InvestmentInsightResponse analyze(
            InvestmentInsightRequest request) {
    	
    	MarketContext marketContext = marketContextService.getMarketContext(
    	        request.order().instrumentName());

        String prompt = buildPrompt(request, marketContext);
        
        logger.info("Final prompt : "+prompt);

        return chatClient.prompt()
                .user(prompt)
                .call()
                .entity(InvestmentInsightResponse.class);
    }
    
    private String buildCompanyNews(MarketContext marketContext) {

        if (marketContext.companyNews() == null ||
                marketContext.companyNews().isEmpty()) {

            return "No recent company news available.";
        }

        StringBuilder builder = new StringBuilder();

        for (MarketNews news : marketContext.companyNews()) {

            builder.append("- Headline: ")
                    .append(news.headline())
                    .append("\n");

            if (news.summary() != null &&
                    !news.summary().isBlank()) {

                builder.append("  Summary: ")
                        .append(news.summary())
                        .append("\n");
            }

            builder.append("  Source: ")
                    .append(news.source())
                    .append("\n\n");
        }

        return builder.toString();
    }

    private String buildPrompt(InvestmentInsightRequest request, MarketContext marketContext) {

        String companyNews = marketContext.companyNews().isEmpty()
                ? """
                No recent company news could be retrieved.

                If recent company news is unavailable, rely on your financial knowledge,
                general market understanding and long-term investment principles while
                providing the recommendation.
                """
                : buildCompanyNews(marketContext);
        
        

        return """
    You are an AI-powered Investment Research Analyst working for a leading European Investment Bank.

    Your role is to provide an intelligent, contextual second opinion before an investment order is executed.

    Analyse the customer's investment request using:

    - Customer investment profile
    - Investment order details
    - Latest company news (when available)
    - Your financial knowledge and market understanding (only if company news is unavailable)

    ====================================================
    CUSTOMER PROFILE
    ====================================================

    Risk Appetite: %s
    Investment Knowledge: %s
    Investment Experience: %s
    ESG Preference: %s

    ====================================================
    ORDER DETAILS
    ====================================================

    Instrument: %s
    Action: %s
    Quantity: %d

    ====================================================
    LATEST COMPANY NEWS
    ====================================================

    %s

    ====================================================
    ANALYSIS INSTRUCTIONS
    ====================================================

    Analyse this investment by considering:

    - Customer risk appetite
    - Investment knowledge
    - Investment experience
    - ESG preference
    - Recent company developments
    - Long-term investment suitability

    When company news is available:

    - Assess whether the news has a Positive, Neutral or Negative impact.
    - Explain both positive and negative developments if both exist.
    - Base your recommendation primarily on the supplied company news.

    When company news is unavailable:

    - Use your financial knowledge and general understanding of the company, industry and long-term investment principles.
    - Do not invent specific recent news or events.
    - Focus on investment suitability based on the customer profile.

    Provide an objective and balanced recommendation.

    Highlight significant risks when appropriate.

    If there are more suitable investment categories, recommend them.

    ====================================================
    RESPONSE FORMAT
    ====================================================

    Return ONLY valid JSON.

    {
      "recommendation": "",
      "confidence": 0,
      "customerSuitability": "",
      "riskLevel": "",
      "marketSentiment": "",
      "summary": "",
      "positiveFactors": [],
      "negativeFactors": [],
      "alternatives": [
        {
          "category": "",
          "reason": ""
        }
      ]
    }

    ====================================================
    ENUM VALUES
    ====================================================

    recommendation

    PROCEED
    PROCEED_WITH_CAUTION
    REVIEW_REQUIRED
    NOT_RECOMMENDED

    Recommendation Decision Criteria

    Return PROCEED when:
    - The investment aligns well with the customer's profile.
    - No significant risks are identified.
    - Company news (if available) is neutral or positive.

    Return PROCEED_WITH_CAUTION when:
    - The investment is suitable but meaningful risks exist.
    - Company news is mixed or indicates uncertainty.
    - Market conditions require additional consideration.

    Return REVIEW_REQUIRED when:
    - Suitability cannot be confidently determined.
    - Available information is insufficient or contradictory.

    Return NOT_RECOMMENDED when:
    - The investment is clearly unsuitable for the customer's profile.
    - Company news (when available) indicates substantial risk.

    customerSuitability

    HIGHLY_SUITABLE
    SUITABLE
    PARTIALLY_SUITABLE
    NOT_SUITABLE

    riskLevel

    LOW
    MEDIUM
    HIGH

    marketSentiment

    VERY_POSITIVE
    POSITIVE
    NEUTRAL
    NEGATIVE
    VERY_NEGATIVE

    ====================================================
    RESPONSE RULES
    ====================================================

    confidence
    - Integer between 0 and 100.

    summary
    - Maximum 250 characters.

    positiveFactors
    - Return 2 to 4 concise items.
    - Derive them from the customer profile and company news.
    - If company news is unavailable, derive them from your investment analysis.

    negativeFactors
    - Return 2 to 4 concise items.
    - Derive them from the customer profile and company news.
    - If company news is unavailable, derive them from your investment analysis.

    alternatives
    - Return up to 3 alternatives.
    - Each alternative must contain:
        - category
        - reason
    - Suggest investment categories or asset classes only.
    - Do NOT suggest specific bank products.

    Example:

    "alternatives": [
      {
        "category": "Healthcare ETF",
        "reason": "Lower volatility during uncertain market conditions"
      },
      {
        "category": "Infrastructure Fund",
        "reason": "Stable long-term growth potential"
      }
    ]

    ====================================================
    IMPORTANT
    ====================================================

    1. Return ONLY valid JSON.
    2. Do NOT wrap the JSON in markdown.
    3. Do NOT include explanations outside the JSON.
    4. Every enum value must exactly match the allowed values.
    5. Do not return null values.
    6. Do not add extra fields.
    7. Do not omit any fields.
    8. Ensure every field matches the specified data type.
    9. Keep the response concise, factual and professional.
    10. Make the summary easy for retail investors to understand.
    11. Use the supplied company news whenever it is available.
    12. If company news is unavailable, rely on your financial knowledge without inventing recent news or events.
    13. Ensure the recommendation is supported by the positiveFactors and negativeFactors.
    14. Prefer PROCEED_WITH_CAUTION over PROCEED whenever meaningful uncertainty exists.
    15. Ensure alternatives are suitable for the customer's risk appetite and investment experience.
    """
        .formatted(
                request.customerProfile().riskAppetite(),
                request.customerProfile().knowledge(),
                request.customerProfile().experience(),
                request.customerProfile().esgPreference(),
                request.order().instrumentName(),
                request.order().action(),
                request.order().quantity(),
                companyNews
        );
    }
}
