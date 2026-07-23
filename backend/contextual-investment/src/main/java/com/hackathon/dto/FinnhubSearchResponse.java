package com.hackathon.dto;

import java.util.List;

public record FinnhubSearchResponse(

        int count,

        List<SearchResult> result

) {
}