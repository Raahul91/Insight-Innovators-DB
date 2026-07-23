package com.hackathon.service;

import com.hackathon.dto.InvestmentInsightRequest;
import com.hackathon.dto.InvestmentInsightResponse;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class InvestmentInsightService {

    private final ChatClient chatClient;

    public InvestmentInsightService(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    public InvestmentInsightResponse analyze(
            InvestmentInsightRequest request) {

        String prompt = buildPrompt(request);

        return chatClient.prompt()
                .user(prompt)
                .call()
                .entity(InvestmentInsightResponse.class);
    }

    private String buildPrompt(InvestmentInsightRequest request) {

        return """
    You are an AI-powered Investment Research Analyst working for a leading European Investment Bank.

    Your role is to provide an intelligent, contextual second opinion before an investment order is executed.

    Analyse the customer's investment request using the customer's investment profile together with the latest publicly available market information.

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
    ANALYSIS INSTRUCTIONS
    ====================================================

    Analyse this investment by considering:

    - Current market sentiment
    - Recent news related to the selected instrument
    - Sector outlook
    - Market volatility
    - Interest rate expectations
    - Inflation trends
    - Geopolitical developments
    - IPO activities
    - Regulatory developments
    - ESG developments
    - Long-term investment outlook
    - Customer suitability based on the investment profile

    Provide an unbiased recommendation.

    If market conditions introduce significant risks, clearly explain them.

    If there are more suitable investment categories, recommend them.

    ====================================================
    RESPONSE FORMAT
    ====================================================

    Return ONLY valid JSON in the following structure.

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
	- The investment is well aligned with the customer's risk appetite, knowledge and experience.
	- There are no significant market risks that materially impact the investment.
	- The overall outlook is stable or positive.
	
	Return PROCEED_WITH_CAUTION only when there are meaningful risks that the customer should consider before investing.
	
	Return REVIEW_REQUIRED only when the suitability cannot be confidently determined.
	
	Return NOT_RECOMMENDED only when the investment is clearly unsuitable for the customer's profile or current market conditions present substantial risk.

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
    - Return 2 to 4 items.
    - Each item maximum 100 characters.

    negativeFactors
    - Return 2 to 4 items.
    - Each item maximum 100 characters.

    alternatives
    - Return up to 3 alternatives.
    - Each alternative MUST be an object with:
        - category
        - reason
    - category maximum 100 characters.
    - reason maximum 100 characters.
    - Suggest investment categories or asset classes only.
    - Do NOT generate specific bank product names.

    Example:

    "alternatives": [
      {
        "category": "Healthcare ETF",
        "reason": "Lower volatility during uncertain market conditions"
      },
      {
        "category": "Infrastructure Fund",
        "reason": "Stable long-term returns with defensive characteristics"
      }
    ]

    ====================================================
    IMPORTANT
    ====================================================

    1. Return ONLY valid JSON.
    2. Do NOT wrap the JSON in markdown.
    3. Do NOT include explanations outside the JSON.
    4. Every enum value MUST exactly match one of the allowed values.
    5. Do not return null values.
    6. Do not add extra fields.
    7. Do not omit any fields.
    8. Ensure every field matches the specified data type.
    9. Keep the response concise, factual and professional.
    10. Make the summary easy for retail investors to understand.
    11. Base the recommendation on both the customer profile and the latest available market information.
    12. If market conditions are uncertain, prefer PROCEED_WITH_CAUTION or REVIEW_REQUIRED instead of PROCEED.
    13. Ensure the recommendation is supported by the positiveFactors and negativeFactors.
    """
    .formatted(
            request.customerProfile().riskAppetite(),
            request.customerProfile().knowledge(),
            request.customerProfile().experience(),
            request.customerProfile().esgPreference(),
            request.order().instrumentName(),
            request.order().action(),
            request.order().quantity()
    );
    }
}
