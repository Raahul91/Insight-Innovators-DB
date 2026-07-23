package com.hackathon.dto;

import java.util.List;

public record MarketContext(
        List<String> news,
        List<String> ipoNews,
        List<String> geopoliticalEvents
) {}
